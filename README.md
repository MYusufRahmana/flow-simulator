# Flow Simulator

Desain flow aplikasi, lalu jalankan simulasinya: token data bergerak di setiap garis, node menyala sesuai status, dan log menjelaskan apa yang terjadi. Local-first — tanpa login, tanpa backend, data tersimpan di IndexedDB browser.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test engine, validasi, import
npm run build    # output statis di dist/ (bisa dibuka dari sub-folder mana pun)
```

## Import & contoh

- Import file `.flow.json` lewat tombol **Import** di Home, ikon upload di topbar editor, atau seret file ke halaman Home. Project yang di-import selalu jadi project baru dan langsung dibuka.
- Contoh siap import: [`examples/checkout-toko-online.flow.json`](examples/checkout-toko-online.flow.json) — 22 node: page, input, API, backend, database, payment gateway, decision *Ask me*, tiga jalur gagal, dan cabang paralel (email invoice + pengiriman). Klik tiap node untuk membaca penjelasannya.
- File contoh dibuat oleh `node examples/make-example.cjs examples/checkout-toko-online.flow.json`, dan `npm test` memastikan setiap file di `examples/` valid serta mencapai End di semua cabang.

## Struktur

```text
src/
├── features/simulation/engine.ts      # logika simulasi murni (tanpa React / timer)
├── features/simulation/validation.ts  # cek flow sebelum Play
├── features/projects/io.ts            # export / import .flow.json + validasi
├── features/projects/templates.ts     # contoh: Login, Create User API, Legal, BAST
├── stores/                            # Zustand: flow (dokumen + undo), simulation (runtime), project, ui
├── components/nodes/registry.ts       # satu tempat untuk semua tipe node (ikon, warna, default)
├── components/nodes/FlowNodeCard.tsx  # satu komponen node untuk semua tipe
├── components/edges/FlowEdge.tsx      # edge dengan token bergerak + preview payload
└── pages/                             # HomePage, EditorPage
```

## Aturan simulasi

- Token mulai di **Start**; payload JSON tiap node di-merge ke data yang dibawa token.
- **Decision**: outcome `TRUE`, `FALSE`, atau `Ask me` (simulasi berhenti dan kamu memilih jalurnya).
- Node yang **gagal** (toggle *Simulate failure*, atau API dengan status ≥ 400) mengikuti handle merah **FAILED** di sisi kanan; tanpa jalur gagal, flow berhenti.
- **Error** node menandai status gagal lalu tetap meneruskan ke node berikutnya (mis. ke End).
- Node dengan banyak garis keluar menjalankan cabang paralel; token yang bertemu di node yang sama digabung.
- Status runtime tidak pernah disimpan ke file project dan tidak masuk undo history.
