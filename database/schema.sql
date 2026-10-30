-- ============================================================================
-- DATABASE SCHEMA: KasirKu (Sistem Kasir Toko Kelontong)
-- Engine: Supabase PostgreSQL
-- ============================================================================

-- 1. TABEL PENGGUNA (USERS)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'kasir' CHECK (role IN ('pemilik', 'kasir')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL PENGATURAN TOKO (STORE_SETTINGS)
CREATE TABLE IF NOT EXISTS store_settings (
    id SERIAL PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(25),
    receipt_header TEXT,
    receipt_footer TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL KATEGORI PRODUK (CATEGORIES)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active SMALLINT DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL PRODUK UTAMA (PRODUCTS)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL UNIQUE,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(150) NOT NULL,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    sell_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (sell_price >= 0),
    base_unit VARCHAR(20) NOT NULL, -- Satuan dasar stok: 'sachet', 'kg', 'liter', 'pcs', 'bungkus'
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (stock >= 0),
    min_stock NUMERIC(12, 2) NOT NULL DEFAULT 5.00 CHECK (min_stock >= 0),
    is_active SMALLINT DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL MULTI-SATUAN PRODUK (PRODUCT_UNITS)
-- Mendukung satuan bertingkat (sachet, renteng, dus, 1/2 kg, dsb.)
CREATE TABLE IF NOT EXISTS product_units (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name VARCHAR(30) NOT NULL, -- cth: 'renteng', 'dus', '1/2 kg'
    conversion_factor NUMERIC(10, 3) NOT NULL CHECK (conversion_factor > 0), -- faktor pengali terhadap base_unit (cth: 1 renteng = 10 sachet)
    sell_price NUMERIC(12, 2) NOT NULL CHECK (sell_price >= 0),
    barcode VARCHAR(100) UNIQUE,
    is_active SMALLINT DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL BARCODE PRODUK TAMBAHAN (PRODUCT_BARCODES)
-- Satu produk atau satuan dapat memiliki beberapa alternatif barcode
CREATE TABLE IF NOT EXISTS product_barcodes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES product_units(id) ON DELETE CASCADE,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    notes VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL TRANSAKSI PENJUALAN (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cashier_name VARCHAR(100),
    customer_name VARCHAR(100) DEFAULT 'Umum',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cash_received >= 0),
    change_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
    payment_method VARCHAR(20) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL DETAIL TRANSAKSI (TRANSACTION_DETAILS)
CREATE TABLE IF NOT EXISTS transaction_details (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit_id INTEGER REFERENCES product_units(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(150) NOT NULL,
    unit_snapshot VARCHAR(30) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    conversion_factor_snapshot NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    base_quantity NUMERIC(12, 2) NOT NULL CHECK (base_quantity > 0), -- quantity * conversion_factor
    cost_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 9. TABEL STOK MASUK (STOCK_ENTRIES)
CREATE TABLE IF NOT EXISTS stock_entries (
    id SERIAL PRIMARY KEY,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier_name VARCHAR(100),
    total_cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_cost >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABEL DETAIL STOK MASUK (STOCK_ENTRY_DETAILS)
CREATE TABLE IF NOT EXISTS stock_entry_details (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES stock_entries(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 11. TABEL RIWAYAT MUTASI STOK (STOCK_MOVEMENTS)
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('penjualan', 'stok_masuk', 'penyesuaian', 'pembatalan')),
    quantity NUMERIC(12, 2) NOT NULL, -- Positif (masuk) / Negatif (keluar)
    balance_after NUMERIC(12, 2) NOT NULL CHECK (balance_after >= 0),
    reference_id VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABEL ARUS KAS / MODAL (CASH_FLOWS)
CREATE TABLE IF NOT EXISTS cash_flows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('modal_awal', 'kas_masuk', 'kas_keluar')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEKS OPTIMASI PENCARIAN & RELASI
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(barcode);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_lookup ON product_barcodes(barcode);

CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_transaction_details_tx ON transaction_details(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_details_prod ON transaction_details(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_date ON stock_movements(product_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_date ON cash_flows(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entry_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;

-- Kebijakan default: Service Role & Backend API memiliki akses penuh (Full Access)
-- Dalam arsitektur Express / Vercel Serverless, API berkomunikasi melalui SUPABASE_SERVICE_ROLE_KEY atau Anon Key dengan verifikasi autentikasi di backend.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_users') THEN
        CREATE POLICY service_role_full_users ON users FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_store_settings') THEN
        CREATE POLICY service_role_full_store_settings ON store_settings FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_categories') THEN
        CREATE POLICY service_role_full_categories ON categories FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_products') THEN
        CREATE POLICY service_role_full_products ON products FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_product_units') THEN
        CREATE POLICY service_role_full_product_units ON product_units FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_product_barcodes') THEN
        CREATE POLICY service_role_full_product_barcodes ON product_barcodes FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_transactions') THEN
        CREATE POLICY service_role_full_transactions ON transactions FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_transaction_details') THEN
        CREATE POLICY service_role_full_transaction_details ON transaction_details FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_stock_entries') THEN
        CREATE POLICY service_role_full_stock_entries ON stock_entries FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_stock_entry_details') THEN
        CREATE POLICY service_role_full_stock_entry_details ON stock_entry_details FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_stock_movements') THEN
        CREATE POLICY service_role_full_stock_movements ON stock_movements FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_cash_flows') THEN
        CREATE POLICY service_role_full_cash_flows ON cash_flows FOR ALL USING (true);
    END IF;
END $$;
