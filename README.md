# 🛒 KasirKu - Sistem Kasir & Manajemen Stok Toko Kelontong (Mobile-First PWA)

Aplikasi kasir (Point of Sale) modern berbasis website untuk toko kelontong atau toko sembako yang dirancang khusus untuk berjalan optimal pada perangkat ponsel pintar (HP), tablet, maupun komputer desktop.

Aplikasi ini dibangun menggunakan arsitektur **Serverless** yang siap di-deploy secara gratis melalui **Vercel** dengan database cloud **Supabase PostgreSQL**, serta tetap dapat dijalankan secara instan dan offline secara lokal.

---

## 🌟 Fitur Utama
1. **Kasir Penjualan Cepat (Mode Alfamart / Continuous Multi-Scan)**: Pemindaian barcode kamera beruntun tanpa menutup kamera, suara beep otentik kasir minimarket (1950Hz), kilat laser hijau instan, getaran haptic ponsel, kontrol senter (torch), ganti kamera, integrasi barcode gun USB/Bluetooth, pencarian memori <1ms, cetak struk nota, dan kalkulasi uang kembalian.
2. **Multi-Satuan Produk**: Mendukung penjualan per satuan dasar (cth: sachet, bungkus, kg) dan satuan bertingkat/grosir (cth: renteng = 10 sachet, dus = 40 bungkus, karung 25kg, 1/2 kg, 1/4 kg).
3. **Manajemen Stok Real-Time & Mutasi**: Pengurangan stok otomatis berbasis transaksi atomik (ACID), pencegahan stok minus, kulakan (stok masuk), dan stock opname fisik.
4. **Pencatatan Arus Kas**: Input modal awal kasir, kas masuk, dan kas keluar operasional untuk kontrol laci kasir harian.
5. **Autentikasi Dua Peran**: Akses khusus Pemilik Toko (*owner*) dan Kasir Toko (*cashier*).
6. **Mobile-First PWA**: Ringan, responsif, dan dapat diinstal ke layar utama HP (*Add to Home Screen*) tanpa perlu mengunduh dari Play Store/App Store.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, CSS3, Bootstrap 5 (Mobile First Design, tanpa framework berat).
- **Backend**: Node.js LTS, Express.js (Arsitektur Serverless Functions untuk Vercel).
- **Database**: 
  - **Supabase PostgreSQL** (Production / Cloud Deployment) dengan NUMERIC precision, RLS, dan fungsi RPC atomik.
  - **SQLite** (Pengembangan lokal offline instan tanpa konfigurasi tambahan).
- **Validasi Keamanan**: Zod (`zod`), stateless HTTP-Only JWT Cookie (`jsonwebtoken`, `cookie-parser`).
- **Hosting & Deployment**: Vercel (Edge CDN + Serverless Functions) & GitHub.

---

## 📁 Struktur Direktori Proyek

```text
Kasir-Project/
├── api/
│   └── index.js             # Entrypoint serverless function untuk deployment Vercel
├── database/
│   ├── schema.sql           # Skema DDL 11 tabel utama PostgreSQL + RLS + Indeks
│   ├── functions.sql        # Database RPC atomik transaksi & auto-update timestamps
│   ├── seed.sql             # Data awal master sembako, multi-satuan, & akun default
│   └── kasirku.sqlite       # Database SQLite lokal untuk pengembangan offline
├── public/
│   ├── css/                 # Stylesheet desain elegan toko kelontong
│   ├── js/                  # Skrip frontend: kasir.js, app.js, barcode.js, html5-qrcode
│   ├── images/              # Ikon aplikasi PWA (192px, 512px)
│   ├── favicon.ico
│   ├── manifest.json        # Konfigurasi PWA Web App Manifest
│   └── service-worker.js    # Caching aset statis untuk performa cepat di HP
├── src/
│   ├── app.js               # Konfigurasi Express, middleware, routing, & auth
│   ├── config/
│   │   ├── database.js      # Database adapter (Supabase PostgreSQL / MySQL / SQLite fallback)
│   │   └── supabase.js      # Inisialisasi Supabase JS Client (@supabase/supabase-js)
│   ├── controllers/         # Handler bisnis: auth, product, transaction, stock, cash, report
│   ├── middleware/          # authMiddleware (JWT stateless + session)
│   ├── routes/              # Routing API Express
│   ├── services/            # Service mutasi stok
│   └── utils/
│       └── validation.js    # Skema validasi Zod untuk data masuk
├── views/                   # Tampilan HTML mobile-first (dashboard, kasir, produk, stok, laporan, pengaturan, login)
├── .env.example             # Contoh environment variables
├── .gitignore               # Proteksi kredensial rahasia & SQLite lokal
├── package.json
├── server.js                # Server entrypoint untuk pengembangan lokal (node server.js)
├── vercel.json              # Konfigurasi routing & serverless bundle Vercel
└── README.md
```

---

## 🚀 Panduan Deployment: Dari Awal Hingga Online

Ikuti langkah-langkah terstruktur berikut untuk mempublikasikan aplikasi KasirKu ke internet secara gratis menggunakan **Supabase** dan **Vercel**.

### Langkah 1: Buat Proyek di Supabase
1. Buka [https://supabase.com](https://supabase.com) dan masuk menggunakan akun GitHub Anda.
2. Klik tombol **New Project**.
3. Isi informasi proyek:
   - **Name**: `kasirku-pos` (atau nama toko Anda)
   - **Database Password**: Buat password yang kuat dan catat password ini.
   - **Region**: Pilih yang terdekat (contoh: `Singapore - ap-southeast-1`).
   - **Pricing Plan**: Free Tier.
4. Klik **Create new project** dan tunggu 1-2 menit hingga status database aktif (*Healthy*).

---

### Langkah 2: Eksekusi File SQL di SQL Editor Supabase
1. Pada menu navigasi sebelah kiri dashboard Supabase, klik **SQL Editor** (ikon terminal `>_`).
2. Klik **New query**.
3. Buka file `database/schema.sql` pada proyek ini, salin seluruh kodenya, tempelkan ke SQL Editor Supabase, lalu klik **Run**.
4. Buat query baru, buka file `database/functions.sql`, salin kodenya, tempelkan, lalu klik **Run**.
5. Buat query baru, buka file `database/seed.sql`, salin kodenya, tempelkan, lalu klik **Run**.
6. Buka menu **Table Editor** untuk memastikan ke-11 tabel (`users`, `store_settings`, `categories`, `products`, `product_units`, `product_barcodes`, `transactions`, `transaction_details`, `stock_entries`, `stock_entry_details`, `stock_movements`, dan `cash_flows`) telah terbuat dan terisi data awal.

---

### Langkah 3: Ambil Kredensial Supabase
1. Buka **Project Settings** (ikon gerigi di kiri bawah).
2. Masuk ke tab **API**:
   - Salin **Project URL** (ini adalah `SUPABASE_URL`).
   - Salin **anon public key** (ini adalah `SUPABASE_ANON_KEY`).
   - Salin **service_role secret** (ini adalah `SUPABASE_SERVICE_ROLE_KEY` - *jangan pernah berikan ke orang lain*).
3. Masuk ke tab **Database**:
   - Scroll ke bagian **Connection string** -> pilih tab **URI**.
   - Pilih mode **Transaction** (Pooler port `6543`) untuk serverless:
     `postgres://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Ganti `[YOUR-PASSWORD]` dengan password database yang Anda buat pada Langkah 1.
   - Salin string tersebut (ini adalah `DATABASE_URL`).

---

### Langkah 4: Unggah Proyek ke GitHub
1. Buat repositori baru di [GitHub](https://github.com/new) (contoh: `kasirku-project`).
2. Di komputer lokal Anda, jalankan perintah git:
   ```bash
   git init
   git add .
   git commit -m "feat: inisialisasi arsitektur kasirku vercel dan supabase"
   git branch -M main
   git remote add origin https://github.com/USERNAME/kasirku-project.git
   git push -u origin main
   ```

---

### Langkah 5: Hubungkan ke Vercel
1. Buka [https://vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik tombol **Add New...** -> **Project**.
3. Pilih repositori GitHub `kasirku-project` yang baru saja Anda unggah, lalu klik **Import**.
4. Pada form **Configure Project**:
   - **Framework Preset**: Pilih `Other` (jangan ubah pengaturan build command).
   - **Root Directory**: `./` (default).

---

### Langkah 6: Atur Environment Variables di Vercel
Buka accordion **Environment Variables** sebelum menekan tombol deploy, lalu tambahkan variabel berikut:

| Nama Variabel | Nilai / Keterangan |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Buat teks rahasia acak panjang (cth: `kasirku_secret_prod_9876543210`) |
| `DB_CLIENT` | `supabase` |
| `DATABASE_URL` | String URI Pooler PostgreSQL dari Langkah 3 |
| `SUPABASE_URL` | URL proyek Supabase dari Langkah 3 |
| `SUPABASE_ANON_KEY` | Public anon key dari Langkah 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key dari Langkah 3 |

---

### Langkah 7: Deploy dan Verifikasi
1. Klik tombol **Deploy**.
2. Vercel akan memproses deployment dalam waktu kurang dari 1 menit.
3. Setelah selesai, klik **Continue to Dashboard** atau klik URL yang disediakan (misal: `https://kasirku-project.vercel.app`).
4. Uji koneksi:
   - Buka `https://URL-VERCEL-ANDA/api/health` -> pastikan menghasilkan `{"status":"ok", ...}`.
   - Buka `https://URL-VERCEL-ANDA/login`.
   - Masuk menggunakan akun default:
     - **Username**: `kasir`
     - **Password**: `kasir123`
     *(Atau akun pemilik: `pemilik` / `pemilik123`)*.
5. Uji transaksi di menu **Kasir**:
   - Pindai barcode atau ketik nama produk (contoh: Indomie Goreng).
   - Masukkan nominal uang tunai yang diterima.
   - Selesaikan transaksi dan periksa struk nota belanja serta pengurangan stok.
6. Uji instalasi PWA di smartphone:
   - Buka URL aplikasi di Google Chrome / Safari HP.
   - Tekan menu browser titik tiga (atau tombol Share di iPhone) -> pilih **"Tambahkan ke Layar Utama" (Add to Home screen)**.
   - Aplikasi KasirKu kini terinstal di HP layaknya aplikasi native!

---

## 💻 Menjalankan Secara Lokal (Offline Development)

Anda dapat mengembangkan aplikasi ini di laptop/PC tanpa koneksi internet sama sekali menggunakan SQLite bawaan:

1. Pastikan Node.js LTS telah terpasang.
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Salin file environment:
   ```bash
   cp .env.example .env
   ```
4. Jalankan server lokal:
   ```bash
   npm run dev
   # atau
   npm start
   ```
5. Buka browser di `http://localhost:3000`.

---

## 🛡️ Keamanan & Integritas Data

- **Perhitungan Harga Sisi Server**: Total transaksi, potongan diskon, dan saldo kembalian dihitung ulang di backend dan fungsi database untuk mencegah manipulasi data dari frontend.
- **Pencegahan Stok Minus**: Menggunakan constraint SQL `CHECK (stock >= 0)` dan kunci baris `FOR UPDATE` di PostgreSQL untuk mengeliminasi potensi *race condition*.
- **Row Level Security (RLS)**: Seluruh tabel Supabase PostgreSQL diproteksi dengan RLS aktif, memastikan akses hanya dapat dilakukan melalui kredensial resmi.
- **Stateless Session Token**: Sesi login menggunakan token JWT bertanda tangan digital dalam HTTP-Only Cookie yang tahan terhadap restart serverless lambda Vercel.

---

## ❓ Panduan Pemecahan Masalah (Troubleshooting)

1. **Error: Database Connection Timeout / Max Clients Reached pada Supabase**:
   - **Solusi**: Pastikan `DATABASE_URL` menggunakan port connection pooler (`6543`) dengan parameter `?pgbouncer=true`, bukan port direct (`5432`). Mode serverless Vercel membuka koneksi baru pada setiap lambda, sehingga pooler wajib digunakan.
2. **Halaman menampilkan 401 saat refresh di Vercel**:
   - **Solusi**: Pastikan environment variable `SESSION_SECRET` telah diisi di Vercel Dashboard -> Project Settings -> Environment Variables.
3. **Kamera barcode scanner tidak aktif**:
   - **Solusi**: Browser mewajibkan protokol HTTPS agar kamera dapat diakses. Di localhost kamera dapat berjalan langsung, sedangkan di production Vercel otomatis menyediakan sertifikat SSL HTTPS gratis. Pastikan Anda mengizinkan (*Allow*) izin akses kamera di browser ponsel.
4. **Error: `table transaction_details has no column named unit_id` saat lokal**:
   - **Solusi**: Sistem telah dilengkapi migrasi otomatis. Cukup restart server `node server.js` dan kolom baru akan langsung disinkronkan ke SQLite lokal Anda.

---

**KasirKu** © 2026 - Didesain untuk kemudahan dan efisiensi operasional pedagang toko kelontong Indonesia.
