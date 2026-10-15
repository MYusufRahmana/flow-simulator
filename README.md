<p align="center">
  <img src="src/assets/logo-full.png" alt="Flow Simulator" height="72" />
</p>

<p align="center">
  Gambar alur aplikasi atau proses bisnis, jalankan simulasinya, lalu export untuk presentasi.<br />
  Berjalan sepenuhnya di browser: tanpa login, tanpa backend.
</p>

---

## Daftar isi

- [Apa ini?](#apa-ini)
- [Fitur](#fitur)
- [Mulai cepat](#mulai-cepat)
- [Cara pakai](#cara-pakai)
- [Shortcut keyboard](#shortcut-keyboard)
- [Aturan simulasi](#aturan-simulasi)
- [Penyimpanan data](#penyimpanan-data)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Struktur proyek](#struktur-proyek)
- [Teknologi](#teknologi)

## Apa ini?

Flow Simulator punya dua mode kerja dalam satu kanvas:

| | **Simulasi** | **Flowchart** |
|---|---|---|
| Untuk | Developer & analis: mendesain alur teknis aplikasi | Presentasi ke user, manajemen, atau direksi |
| Komponen | Start, Page, Input, API, Backend, Database, Decision, Error, … | Terminator, User, Process, Decision, Input/Output, Document, Database, Note, Text, … |
| Isi tiap komponen | Endpoint, method, status code, payload JSON, tabel database, … | Cukup teks dan warna |
| Animasi | Token data berjalan saat tombol **Run simulation** ditekan | Garis penghubung **beranimasi sendiri**, tanpa perlu menekan apa pun |

Kedua jenis komponen bisa ada di satu kanvas, tetapi tidak bisa saling disambungkan. Simulasi hanya membaca komponen Simulasi.

## Fitur

**Menggambar**
- Drag komponen dari panel kiri, atau klik untuk menaruhnya di tengah layar.
- Tarik garis dari titik sambung ke komponen lain. Kalau dilepas di area kosong, muncul menu untuk langsung membuat komponen berikutnya yang tersambung.
- **Edit teks langsung di kanvas**: klik dua kali, atau pilih komponen lalu langsung ketik.
- Ukuran bentuk flowchart mengikuti grid, sehingga garis mudah lurus. Ada tombol **Sejajarkan baris/kolom** untuk beberapa komponen sekaligus.
- **Menu klik kanan**: edit, duplikat, copy/cut/paste, ganti tipe, warna, balik arah panah, hapus, tambah komponen di titik klik.
- Undo/redo (100 langkah), copy/paste antar project, pilih banyak komponen dengan Shift + drag.

**Simulasi**
- Mode Auto atau Step, kecepatan 0.5x–4x, kamera mengikuti token.
- Decision bisa diatur TRUE, FALSE, atau *Ask me* (simulasi berhenti dan Anda memilih jalurnya).
- Simulasi kegagalan, cabang paralel, payload JSON yang ikut berjalan di setiap garis, dan log langkah demi langkah.
- Validasi sebelum simulasi: Start/End hilang, cabang Decision belum lengkap, node yang tidak terjangkau.

**Presentasi & export**
- Mode presentasi layar penuh (tombol **P**).
- Export ke **PNG, JPG, SVG, PDF** (A4, A3, atau seukuran diagram, opsional dengan judul dan tanggal), atau **Copy gambar** langsung ke clipboard untuk di-paste ke PowerPoint, Word, atau chat.
- Pilihan area (semua / yang dipilih), latar (putih / abu / transparan), dan resolusi (1x–3x).
- Export/import project sebagai file `.flow.json`.

**Template siap pakai**: Login Flow, Create User API, Legal Incoming Letter, Inventory BAST, dan Flowchart Pengajuan Cuti.

## Mulai cepat

Butuh **Node.js 20+**.

```bash
git clone https://github.com/MYusufRahmana/flow-simulator.git
cd flow-simulator
npm install
npm run dev        # http://localhost:5173
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development dengan hot reload |
| `npm test` | Unit test: engine simulasi, validasi, import, dan aksi editor |
| `npm run lint` | ESLint |
| `npm run build` | Build produksi ke `dist/` (file statis, bisa dibuka dari sub-folder mana pun) |
| `npm run preview` | Menjalankan hasil build secara lokal |

## Cara pakai

### Membuat flowchart untuk presentasi

1. Di halaman Home, klik **New diagram** atau pilih template **Flowchart Pengajuan Cuti**. Project kosong baru berisi satu node Start dari tab Simulasi; hapus saja kalau hanya ingin membuat flowchart.
2. Di panel kiri, pilih tab **Flowchart**.
3. Drag bentuk ke kanvas. Teksnya langsung terblok, jadi cukup ketik untuk menggantinya.
4. Tarik garis dari titik di sisi bentuk ke bentuk lain. Garis dari **Decision** otomatis diberi label **Ya** (bawah) dan **Tidak** (kanan).
5. Rapikan dengan klik kanan → **Sejajarkan baris/kolom**, lalu ganti warna lewat klik kanan → **Warna**.
6. Tekan **P** untuk mode presentasi, atau **Ctrl+E** untuk export.

### Membuat simulasi alur aplikasi

1. Pilih tab **Simulasi**, lalu susun alurnya dari **Start** sampai **End**.
2. Klik sebuah komponen untuk mengisi detailnya di panel kanan: endpoint API, status code, tabel database, payload JSON, dan lainnya.
3. Klik **Run simulation** (Ctrl+Enter). Klik komponen mana pun selama simulasi untuk melihat data yang dihasilkannya.

### Import contoh

Import file `.flow.json` lewat tombol **Import** di Home atau di topbar editor, atau seret file ke halaman Home. Project yang di-import selalu menjadi project baru.

Contoh siap import: [`examples/checkout-toko-online.flow.json`](examples/checkout-toko-online.flow.json). Isinya 22 node: page, input, API, backend, database, payment gateway, decision *Ask me*, tiga jalur gagal, dan cabang paralel (email invoice + pengiriman). File ini dibuat oleh `node examples/make-example.cjs examples/checkout-toko-online.flow.json`, dan `npm test` memastikan setiap file di `examples/` valid serta mencapai End di semua cabang.

## Shortcut keyboard

Daftar lengkapnya bisa dibuka di aplikasi dengan tombol **?**.

| Shortcut | Fungsi |
|---|---|
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / Cut / Paste |
| `Ctrl+D` | Duplikat |
| `Ctrl+A` | Pilih semua |
| `Delete` | Hapus yang dipilih |
| `Ctrl+S` | Simpan sekarang |
| `Ctrl+E` | Export |
| `Ctrl+Enter` | Jalankan simulasi |
| `Space` / `→` / `R` | Play-pause / langkah berikutnya / ulang (saat simulasi) |
| Klik dua kali, `Enter`, `F2` | Edit teks bentuk flowchart |
| `Shift+Enter` | Baris baru saat mengedit teks |
| `Shift+1` | Tampilkan seluruh diagram |
| `P` | Mode presentasi |
| Klik kanan | Menu konteks |

## Aturan simulasi

- Token mulai di **Start**. Payload JSON tiap node digabung ke data yang dibawa token.
- **Decision**: outcome `TRUE`, `FALSE`, atau `Ask me`.
- Node yang **gagal** (toggle *Simulate failure*, atau API dengan status ≥ 400) mengikuti titik sambung merah **FAILED** di sisi kanan. Tanpa jalur gagal, flow berhenti.
- **Error** menandai status gagal, lalu tetap meneruskan ke node berikutnya (misalnya ke End).
- Node dengan banyak garis keluar menjalankan cabang paralel. Token yang bertemu di node yang sama digabung.
- Komponen Flowchart tidak ikut simulasi.
- Status runtime tidak pernah disimpan ke file project dan tidak masuk riwayat undo.

## Penyimpanan data

Semua project disimpan di **IndexedDB browser** dan tersimpan otomatis setiap ada perubahan. Konsekuensinya:

- Project hanya ada di browser dan perangkat tempat project itu dibuat. Membuka website yang sama di laptop atau browser lain akan menampilkan daftar project kosong.
- Untuk memindahkan atau membagikan project, gunakan **Export → Project (.json)**, lalu **Import** di tempat tujuan.
- Menghapus data situs di pengaturan browser juga menghapus project. Simpan file `.flow.json` sebagai cadangan untuk project penting.

## Deploy ke Vercel

Aplikasi ini adalah situs statis, jadi tidak butuh server atau environment variable.

1. Push repository ke GitHub.
2. Di [vercel.com](https://vercel.com), pilih **Add New → Project**, lalu import repository ini.
3. Vercel mendeteksi Vite secara otomatis. Pastikan pengaturannya seperti ini:

   | Setting | Nilai |
   |---|---|
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. Klik **Deploy**. Setiap push ke branch `main` akan otomatis di-deploy ulang.

Aplikasi memakai hash routing (`/#/editor/...`), jadi tidak perlu `vercel.json` atau aturan rewrite. Hosting statis lain (Netlify, GitHub Pages, sub-folder Laragon/XAMPP) juga bisa dipakai dengan menyalin isi `dist/`.

> **Catatan:** fitur **Copy gambar** ke clipboard hanya berfungsi di HTTPS atau `localhost`. Di Vercel sudah otomatis HTTPS.

## Struktur proyek

```text
src/
├── components/
│   ├── nodes/registry.ts         # satu sumber untuk semua tipe komponen (kategori, ikon, warna, default)
│   ├── nodes/FlowNodeCard.tsx    # tampilan komponen Simulasi
│   ├── nodes/FlowchartNode.tsx   # bentuk Flowchart + edit teks langsung di kanvas
│   ├── edges/FlowEdge.tsx        # garis: token simulasi & animasi otomatis flowchart
│   ├── flow/                     # kanvas, menu klik kanan, menu "tambah & sambungkan"
│   └── panels/                   # palet, panel properti, topbar, dialog export & shortcut
├── features/
│   ├── simulation/engine.ts      # logika simulasi murni (tanpa React / timer)
│   ├── simulation/validation.ts  # pengecekan flow sebelum simulasi
│   ├── projects/io.ts            # export / import .flow.json + validasi
│   ├── projects/templates.ts     # template bawaan
│   └── export/exportDiagram.ts   # export PNG / JPG / SVG / PDF
├── stores/                       # Zustand: flow (dokumen + undo), simulation, project, ui
└── pages/                        # HomePage, EditorPage
```

## Teknologi

[React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) · [React Flow (@xyflow/react)](https://reactflow.dev) · [Zustand](https://zustand.docs.pmnd.rs) · [Tailwind CSS 4](https://tailwindcss.com) · [lucide-react](https://lucide.dev) · [html-to-image](https://github.com/bubkoo/html-to-image) · [jsPDF](https://github.com/parallax/jsPDF) · [Vitest](https://vitest.dev)
