-- ============================================================================
-- DATABASE SCHEMA: KasirKu (Sistem Kasir Toko Kelontong)
-- Engine: MySQL 8.0 / SQLite Compatible
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'kasir',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_settings (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    store_name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(25),
    receipt_header TEXT,
    receipt_footer TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    category_id INTEGER NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    base_unit VARCHAR(20) NOT NULL, -- cth: kg, liter, pcs, bungkus
    stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- mendukung desimal (cth: 2.5 kg)
    min_stock DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS product_units (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    product_id INTEGER NOT NULL,
    unit_name VARCHAR(30) NOT NULL, -- cth: 1/2 kg, 1/4 kg, Dus, Renceng
    conversion_factor DECIMAL(10, 3) NOT NULL, -- faktor kali terhadap satuan dasar
    sell_price DECIMAL(12, 2) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cashier_id INTEGER,
    cashier_name VARCHAR(100),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cash_received DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(20) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_details (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name_snapshot VARCHAR(150) NOT NULL,
    unit_snapshot VARCHAR(30) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    cost_price_snapshot DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_entries (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    entry_number VARCHAR(40) NOT NULL UNIQUE,
    entry_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supplier_name VARCHAR(100),
    total_cost DECIMAL(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_entry_details (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    entry_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES stock_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    product_id INTEGER NOT NULL,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(20) NOT NULL, -- 'penjualan', 'stok_masuk', 'penyesuaian', 'pembatalan'
    quantity DECIMAL(10, 2) NOT NULL, -- bernilai positif (masuk) atau negatif (keluar)
    balance_after DECIMAL(10, 2) NOT NULL,
    reference_id VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
CREATE TABLE IF NOT EXISTS cash_flows (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'modal_awal', 'kas_masuk', 'kas_keluar'
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(50), -- 'modal_kembalian', 'operasional', 'tambah_modal', 'lainnya'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- ============================================================================
-- SEED INITIAL DATA
-- ============================================================================

-- Akun default:
-- 1. Pemilik (Owner): pemilik / pemilik123
-- 2. Kasir (Cashier): kasir / kasir123
INSERT INTO users (id, username, password, name, role) 
VALUES 
(1, 'pemilik', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'H. Ahmad (Pemilik Toko)', 'pemilik'),
(2, 'kasir', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'Kasir Toko Berkah', 'kasir')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Informasi toko
INSERT INTO store_settings (id, store_name, address, phone, receipt_header, receipt_footer)
VALUES (1, 'Toko Kelontong Berkah', 'Jl. Pasar Baru No. 12, Bandung', '0812-3456-7890', 'Menyediakan Sembako & Kebutuhan Harian Murah', 'Terima kasih atas kunjungan Anda!')
ON DUPLICATE KEY UPDATE store_name=VALUES(store_name);

-- Kategori toko kelontong
INSERT INTO categories (id, name, description) VALUES
(1, 'Sembako', 'Beras, gula, minyak goreng, tepung, dan telur'),
(2, 'Minuman', 'Air mineral, teh, kopi, dan minuman kemasan'),
(3, 'Bumbu Dapur', 'Garam, penyedap rasa, kecap, dan rempah instan'),
(4, 'Makanan Ringan', 'Mi instan, biskuit, dan makanan ringan'),
(5, 'Perlengkapan Rumah', 'Sabun mandi, deterjen, dan kebutuhan rumah tangga')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Produk sembako awal dengan stok dan satuan utuh/pecahan
INSERT INTO products (id, category_id, code, barcode, name, cost_price, sell_price, base_unit, stock, min_stock) VALUES
(1, 1, 'PRD-001', '899123456001', 'Beras Ramos Super (per kg)', 13500.00, 15000.00, 'kg', 50.00, 10.00),
(2, 1, 'PRD-002', '899123456002', 'Minyak Goreng Sawit (per liter)', 15000.00, 17500.00, 'liter', 30.00, 5.00),
(3, 1, 'PRD-003', '899123456003', 'Gula Pasir Putih (per kg)', 14000.00, 16000.00, 'kg', 25.00, 5.00),
(4, 1, 'PRD-004', '899123456004', 'Telur Ayam Negeri (per kg)', 26000.00, 28500.00, 'kg', 18.50, 5.00),
(5, 1, 'PRD-005', '899123456005', 'Tepung Terigu Segitiga Biru 1kg', 10500.00, 12000.00, 'bungkus', 20.00, 4.00),
(6, 4, 'PRD-006', '899886620022', 'Indomie Goreng Original 85g', 2900.00, 3500.00, 'bungkus', 80.00, 20.00),
(7, 4, 'PRD-007', '899886620039', 'Indomie Kuah Ayam Bawang 75g', 2800.00, 3300.00, 'bungkus', 60.00, 15.00),
(8, 2, 'PRD-008', '899990900101', 'Aqua Air Mineral 600ml', 2500.00, 3500.00, 'botol', 48.00, 12.00),
(9, 2, 'PRD-009', '899275311201', 'Kopi Kapal Api Spesial Mix 10x24g', 12500.00, 15000.00, 'renceng', 15.00, 3.00),
(10, 3, 'PRD-010', '899274512301', 'Kecap Manis Bango 135ml Refill', 7500.00, 9000.00, 'pouch', 14.00, 3.00),
(11, 5, 'PRD-011', '899999912001', 'Sabun Mandi Lifebuoy Total 10 110g', 3800.00, 4800.00, 'pcs', 24.00, 6.00),
(12, 5, 'PRD-012', '899889912345', 'Deterjen Rinso Molto Bubuk 770g', 19000.00, 22000.00, 'bungkus', 10.00, 2.00)
ON DUPLICATE KEY UPDATE name=VALUES(name);
