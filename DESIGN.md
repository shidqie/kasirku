# 🎨 KasirKu Design System (Impeccable Minimalist)

Dokumen ini mendefinisikan sistem desain visual (*Design System*), token, tata letak, dan panduan antarmuka untuk aplikasi **KasirKu**. Dirancang dengan filosofi **Minimalist & Elegant**: anggun, bersih, efisien, dengan hierarki tipografi yang tajam dan kontras aksesibilitas tinggi standar WCAG AA.

---

## 1. Prinsip Desain (Design Principles)

1. **Clarity over Clutter (Kejelasan di atas Kerumitan)**:
   - Hilangkan ornamen visual yang tidak fungsional (gradien bertumpuk, shadow tebal, badge warna-warni yang berlebihan).
   - Setiap elemen memiliki tujuan operasional yang jelas bagi kasir dan pedagang toko.
2. **Harmonious Whitespace (Ruang Negatif yang Teratur)**:
   - Gunakan ritme spasi teratur (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`) agar antarmuka terasa lapang, tenang, dan tidak menyesakkan mata.
3. **Ergonomis & Mobile-First**:
   - Area sentuh (*touch target*) minimal 40px–44px untuk kenyamanan jempol saat digunakan di ponsel atau tablet kasir.
4. **Tipografi Presisi**:
   - `Google Sans` untuk keterbacaan teks utama yang ramah dan modern.
   - `Anonymous Pro` monospaced untuk angka harga rupiah, kuantitas stok, nomor invoice, dan barcode produk agar angka tersusun rapi secara vertikal.
5. **Aksesibilitas Tanpa Kompromi (WCAG AA Compliant)**:
   - Rasio kontras teks terhadap latar belakang minimal 4.5:1 untuk teks normal dan 3:1 untuk teks besar/badge tebal.

---

## 2. Palet Warna & Token (Color Tokens)

```css
:root {
  /* Brand Primary */
  --color-primary: #2563EB;          /* Royal Blue (Kontras 4.56:1 pada putih) */
  --color-primary-hover: #1D4ED8;    /* Darker Blue */
  --color-primary-subtle: #EFF6FF;   /* Soft Ice Blue */

  /* Secondary / Slate Neutral */
  --color-secondary: #475569;        /* Slate Neutral (Kontras 5.8:1) */
  --color-secondary-subtle: #F1F5F9; /* Light Slate Row */

  /* Status Colors (WCAG AA Compliant on White Surface) */
  --color-success: #15803D;          /* Forest Green (Kontras 4.54:1) */
  --color-success-subtle: #F0FDF4;   /* Mint Tint */

  --color-warning: #B45309;          /* Deep Amber (Kontras 4.6:1) */
  --color-warning-subtle: #FFFBEB;   /* Warm Butter */

  --color-danger: #DC2626;           /* Crimson Red */
  --color-danger-subtle: #FEF2F2;    /* Rose Tint */

  /* Neutrals & Surfaces */
  --color-bg: #F8FAFC;               /* Canvas Light Slate */
  --color-surface: #FFFFFF;          /* Pure White Card */
  --color-surface-subtle: #F1F5F9;   /* Hover / Striped Row */

  /* Borders & Dividers */
  --color-border: #E2E8F0;          /* Crisp Delicate Border 1px */
  --color-border-hover: #CBD5E1;    /* Interactive Border */
  --color-border-focus: #93C5FD;    /* Focus Glow */

  /* Typography Colors */
  --color-text: #111827;             /* Slate 900 (High Contrast) */
  --color-text-muted: #475569;       /* Slate 600 (Subtitles & Labels, Kontras > 5.8:1) */
  --color-text-subtle: #94A3B8;      /* Slate 400 (Placeholders) */
}
```

---

## 3. Tipografi & Skala Teks (Typography Hierarchy)

Font yang digunakan adalah kombinasi **Outfit** (Geometric Sans yang modern, proporsional, dan elegan) dengan **Anonymous Pro** (True Monospace untuk data keuangan):

| Token / Elemen | Font Family | Size | Weight | Line Height | Keterangan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `h1.page-title` | `Outfit` | `1.75rem` (28px) | 700 (Bold) | 1.25 | Judul halaman utama |
| `h2.section-title` | `Outfit` | `1.125rem` (18px) | 700 (Bold) | 1.3 | Judul panel atau widget |
| `h3.card-title` | `Outfit` | `0.9375rem` (15px) | 600 (Semibold) | 1.35 | Judul produk / item |
| `body-md` | `Outfit` | `0.9375rem` (15px) | 400 (Regular) | 1.5 | Teks isi dan paragraf |
| `body-sm` | `Outfit` | `0.875rem` (14px) | 500 (Medium) | 1.4 | Label form dan tombol |
| `caption` | `Outfit` | `0.75rem` (12px) | 500 (Medium) | 1.3 | Catatan kecil & status badge |
| `.mono` | `Anonymous Pro` | Proportional | 400 / 700 | 1.2 | Harga Rupiah, Invoice TRX, Barcode |

---

## 4. Spacing & Radius Sistem (Spatial Foundations)

- **Grid Spacing**: Skala 4px (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
- **Corner Radius**:
  - `sm: 4px` (Badge, input kecil, icon button)
  - `md: 8px` (Card, modal, form input, button utama)
  - `lg: 12px` (Bottom sheet mobile, dialog pop-up)
  - `full: 9999px` (Pills, avatar, status indicator)
- **Bayangan (Shadow Elevation)**:
  - `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.04)` (Card statis)
  - `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)` (Hover card, dropdown)
  - `shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.02)` (Modal dialog)

---

## 5. Komponen Inti (Core Components)

### 1. Tombol (Buttons)
- **Primary**: Latar belakang `#2563EB`, teks `#FFFFFF`, hover `#1D4ED8`.
- **Secondary**: Latar belakang `#FFFFFF`, border `1px solid #E2E8F0`, teks `#111827`, hover latar `#F1F5F9`.
- **Success / Checkout**: Latar belakang `#15803D`, teks `#FFFFFF`.
- **Danger**: Latar belakang `#DC2626`, teks `#FFFFFF`.
- *Micro-interaction*: Transisi `0.15s ease`, aktif `transform: scale(0.98)` saat ditekan.

### 2. Form Input & Pencarian
- Tinggi input standar: `42px` (Desktop) / `44px` (Mobile touch target).
- Border: `1px solid #E2E8F0`.
- Focus state: `border-color: #2563EB`, bayangan halus `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)`.

### 3. Kartu Produk POS (`.product-item-card`)
- Layout vertikal yang rapi: Judul produk (2 baris maksimal), barcode/kategori di bawah judul, pemisah garis halus, harga tebal berwarna primer di kiri bawah, dan tombol tambah (+) di kanan bawah.
- Feedback hover: Mengangkat halus `translateY(-2px)` dengan perubahan border menjadi biru primer.

### 4. Keranjang Belanja Kasir (`.kasir-cart-panel`)
- Pembagian 3 zona:
  1. **Header**: Pemilih kasir bertugas & tombol reset keranjang.
  2. **Body**: Daftar item dengan tombol stepper kuantitas (- dan +) yang responsif dan mudah ditekan.
  3. **Footer**: Ringkasan Subtotal, Total Tagihan besar, tombol cepat pecahan uang pas (Rp 10.000, 20.000, 50.000, 100.000), dan tombol "Bayar Sekarang" yang menonjol.

### 5. Toast Feedback
- Tampil mengambang di pojok kanan bawah desktop atau tengah atas mobile.
- Memberikan sinyal instan saat barcode berhasil dipindai dengan audio synthesizer *beep*.

---

## 6. Audit & Pengujian Kualitas Desain

Gunakan perintah `impeccable detect` untuk memverifikasi kepatuhan desain kapan saja:

```bash
# Uji semua halaman tampilan terhadap anti-pattern desain
npx impeccable detect views/*.html

# Uji tampilan pada viewport perangkat seluler (iPhone / Android)
npx impeccable detect --viewport 390x844 views/*.html

# Uji server lokal yang sedang berjalan
npx impeccable detect http://localhost:3000/login
```

Target kualitas: **0 anti-patterns**, **100% WCAG AA compliant**.
