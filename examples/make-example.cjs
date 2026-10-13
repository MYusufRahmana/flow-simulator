// Generates examples/checkout-toko-online.flow.json for Flow Simulator.
const fs = require('fs');
const path = require('path');

const COL = 300, ROW = 120, TERM = (232 - 160) / 2;
const pos = (kind, col, row) => ({ x: col * COL + (kind === 'start' || kind === 'end' ? TERM : 0), y: Math.round(row * ROW) });

const nodes = [];
const N = (id, type, col, row, data) => nodes.push({ id, type, position: pos(type, col, row), data: { duration: 600, ...data } });

N('start', 'start', 0, 0, { label: 'Pelanggan', duration: 300, description: 'Titik awal. Initial payload = data awal yang dibawa token.', payload: '{\n  "customer_id": 88,\n  "customer": "Budi Santoso"\n}' });
N('cart', 'page', 0, 1, { label: 'Halaman Keranjang', config: { route: '/cart' }, description: 'Page / UI: layar yang dilihat user.' });
N('checkout', 'input', 0, 2, {
  label: 'Klik Checkout', duration: 700,
  config: { fields: 'cart_id, alamat, kurir' },
  description: 'User Input: data yang dikirim user. Payload-nya digabung ke data token.',
  payload: '{\n  "cart_id": "CRT-1029",\n  "items": 2,\n  "total": 250000,\n  "kurir": "JNE REG"\n}',
});
N('api', 'api', 0, 3, {
  label: 'Buat Order', duration: 900,
  config: { method: 'POST', endpoint: '/api/orders', statusCode: 201, response: '{\n  "order_id": "ORD-5531",\n  "status": "PENDING"\n}' },
  description: 'Coba ubah Status code ke 500: token akan mengikuti handle merah (FAILED).',
});
N('ctrl', 'backend', 0, 4, { label: 'OrderController', config: { handler: 'store()' } });
N('stock', 'process', 0, 5, { label: 'Validasi Stok', description: 'Aktifkan "Simulate failure" untuk melihat jalur Stok Habis.' });
N('save', 'database', 0, 6, { label: 'Simpan Order', config: { database: 'shop', table: 'orders', action: 'TRANSACTION' } });
N('pay', 'external', 0, 7, { label: 'Payment Gateway', duration: 1200, config: { service: 'Midtrans' }, description: 'External Service: layanan pihak ketiga. Bisa disimulasikan gagal.' });
N('paid', 'decision', 0, 8, {
  label: 'Pembayaran lunas?', config: { condition: "payment.status == 'settlement'", outcome: 'ASK' },
  description: 'Outcome "Ask me": simulasi berhenti dan kamu memilih TRUE atau FALSE.',
});
N('markpaid', 'database', 0, 9, { label: 'Tandai PAID', config: { database: 'shop', table: 'orders', action: 'UPDATE' }, payload: '{\n  "status": "PAID"\n}', description: 'Punya 2 koneksi keluar: keduanya berjalan paralel.' });
N('ship', 'database', 0, 10, { label: 'Buat Pengiriman', config: { database: 'shop', table: 'shipments', action: 'INSERT' } });
N('email', 'notification', -1, 10, { label: 'Kirim Invoice', config: { channel: 'Email' } });
N('ok', 'output', 0, 11, { label: '201 Order Dibuat', duration: 400 });
N('success', 'page', 0, 12, { label: 'Halaman Sukses', config: { route: '/orders/ORD-5531' } });
N('end', 'end', 0, 13, { label: 'Selesai', duration: 300 });

// Side branches (column 1), each with its own End so lines never cross other nodes.
N('apierr', 'error', 1, 3, { label: 'Gagal Buat Order', duration: 400, config: { code: '500' } });
N('apiend', 'end', 1, 4, { label: 'Selesai (gagal)', duration: 300 });
N('nostock', 'error', 1, 5, { label: 'Stok Habis', duration: 400, config: { code: '409' } });
N('nostockend', 'end', 1, 6, { label: 'Selesai (gagal)', duration: 300 });
N('payfail', 'error', 1, 7, { label: 'Pembayaran Gagal', duration: 400, config: { code: '402' } });
N('waiting', 'page', 1, 8, { label: 'Menunggu Pembayaran', config: { route: '/orders/ORD-5531/pay' }, description: 'Cabang FALSE dari decision.' });
N('waitend', 'end', 1, 9, { label: 'Selesai (tunda)', duration: 300 });

const edges = [];
const E = (source, target, opts = {}) => {
  const { branch, label, from, to } = opts;
  const sourceHandle = from ?? (branch === 'TRUE' ? 'true' : branch === 'FALSE' ? 'false' : branch === 'FAILED' ? 'fail' : 'out');
  const targetHandle = to ?? (branch === 'FALSE' || branch === 'FAILED' ? 'left' : 'top');
  edges.push({ id: `e${edges.length + 1}`, type: 'flow', source, target, sourceHandle, targetHandle, data: { branch, label: label ?? branch?.toLowerCase() } });
};

E('start', 'cart');
E('cart', 'checkout');
E('checkout', 'api', { label: 'checkout' });
E('api', 'ctrl', { label: '201' });
E('api', 'apierr', { branch: 'FAILED' });
E('ctrl', 'stock');
E('stock', 'save', { label: 'stok ada' });
E('stock', 'nostock', { branch: 'FAILED', label: 'habis' });
E('save', 'pay');
E('pay', 'paid');
E('pay', 'payfail', { branch: 'FAILED' });
E('paid', 'markpaid', { branch: 'TRUE', label: 'lunas' });
E('paid', 'waiting', { branch: 'FALSE', label: 'belum' });
E('markpaid', 'ship');
E('markpaid', 'email', { to: 'top' });
E('ship', 'ok');
E('email', 'ok', { to: 'left' });
E('ok', 'success');
E('success', 'end');
E('apierr', 'apiend');
E('nostock', 'nostockend');
E('payfail', 'waiting', { label: 'coba lagi' });
E('waiting', 'waitend');

const now = new Date().toISOString();
const file = {
  version: 1,
  project: {
    id: 'example-checkout',
    name: 'Contoh: Checkout Toko Online',
    description:
      'Contoh lengkap: page, input, API, backend, database, layanan eksternal, decision "Ask me", jalur gagal, dan cabang paralel. Klik node untuk membaca penjelasannya.',
    version: 1,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    settings: { simulationSpeed: 1 },
  },
};

const out = process.argv[2];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(file, null, 2) + '\n');
console.log(`wrote ${out}: ${nodes.length} nodes, ${edges.length} edges`);
