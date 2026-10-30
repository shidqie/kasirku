-- ============================================================================
-- SEED INITIAL DATA: KasirKu Toko Kelontong
-- Engine: Supabase PostgreSQL
-- ============================================================================

-- 1. PENGGUNA DEFAULT (Password default: 'pemilik123' dan 'kasir123' bcrypt hash)
INSERT INTO users (id, username, password, name, role) 
VALUES 
(1, 'pemilik', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'H. Ahmad (Pemilik Toko)', 'pemilik'),
(2, 'kasir', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'Kasir Toko Berkah', 'kasir')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- Sinkronkan sequence ID users
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2. INFORMASI TOKO
INSERT INTO store_settings (id, store_name, address, phone, receipt_header, receipt_footer)
VALUES (
    1, 
    'Toko Kelontong Berkah', 
    'Jl. Pasar Baru No. 12, Bandung', 
    '0812-3456-7890', 
    'Menyediakan Sembako & Kebutuhan Harian Murah', 
    'Terima kasih atas kunjungan Anda! Barang yang sudah dibeli tidak dapat ditukar.'
)
ON CONFLICT (id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone;

-- 3. KATEGORI PRODUK
INSERT INTO categories (id, name, description, is_active) VALUES
(1, 'Sembako', 'Beras, gula, minyak goreng, tepung, dan telur', 1),
(2, 'Minuman', 'Air mineral, teh, kopi, dan minuman kemasan', 1),
(3, 'Bumbu Dapur', 'Garam, penyedap rasa, kecap, dan rempah instan', 1),
(4, 'Makanan Ringan', 'Mi instan, biskuit, dan camilan', 1),
(5, 'Perlengkapan Rumah', 'Sabun mandi, deterjen, dan kebutuhan rumah tangga', 1)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- 4. PRODUK UTAMA (DENGAN SATUAN DASAR STOK)
INSERT INTO products (id, category_id, code, barcode, name, cost_price, sell_price, base_unit, stock, min_stock, is_active) VALUES
(1, 1, 'PRD-001', '899123456001', 'Beras Ramos Super', 13500.00, 15000.00, 'kg', 100.00, 10.00, 1),
(2, 1, 'PRD-002', '899123456002', 'Minyak Goreng Sawit', 15000.00, 17500.00, 'liter', 60.00, 10.00, 1),
(3, 1, 'PRD-003', '899123456003', 'Gula Pasir Putih', 14000.00, 16000.00, 'kg', 50.00, 10.00, 1),
(4, 1, 'PRD-004', '899123456004', 'Telur Ayam Negeri', 26000.00, 28500.00, 'kg', 35.00, 5.00, 1),
(5, 1, 'PRD-005', '899123456005', 'Tepung Terigu Segitiga Biru 1kg', 10500.00, 12000.00, 'bungkus', 40.00, 5.00, 1),
(6, 4, 'PRD-006', '899886620022', 'Indomie Goreng Original 85g', 2900.00, 3500.00, 'bungkus', 200.00, 40.00, 1),
(7, 4, 'PRD-007', '899886620039', 'Indomie Kuah Ayam Bawang 75g', 2800.00, 3300.00, 'bungkus', 150.00, 30.00, 1),
(8, 2, 'PRD-008', '899990900101', 'Aqua Air Mineral 600ml', 2500.00, 3500.00, 'botol', 96.00, 24.00, 1),
(9, 2, 'PRD-009', '899275311201', 'Kopi Kapal Api Spesial Mix 24g', 1250.00, 1500.00, 'sachet', 200.00, 20.00, 1),
(10, 3, 'PRD-010', '899274512301', 'Kecap Manis Bango 135ml Refill', 7500.00, 9000.00, 'pouch', 30.00, 5.00, 1),
(11, 5, 'PRD-011', '899999912001', 'Sabun Mandi Lifebuoy Total 10 110g', 3800.00, 4800.00, 'pcs', 48.00, 12.00, 1),
(12, 5, 'PRD-012', '899889912345', 'Deterjen Rinso Molto Bubuk 770g', 19000.00, 22000.00, 'bungkus', 25.00, 5.00, 1)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    cost_price = EXCLUDED.cost_price,
    sell_price = EXCLUDED.sell_price,
    stock = EXCLUDED.stock;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- 5. MULTI-SATUAN PRODUK (PRODUCT_UNITS)
-- Contoh konversi multi-satuan:
-- Indomie: 1 Dus = 40 bungkus
-- Kopi Kapal Api: 1 Renteng = 10 sachet, 1 Dus = 120 sachet
-- Telur: 1/2 kg = 0.5 kg, 1/4 kg = 0.25 kg
-- Beras: 1 Karung 25kg = 25 kg
INSERT INTO product_units (id, product_id, unit_name, conversion_factor, sell_price, barcode, is_active) VALUES
(1, 6, 'Dus (40 bks)', 40.000, 130000.00, '899886620022-DUS', 1),
(2, 7, 'Dus (40 bks)', 40.000, 125000.00, '899886620039-DUS', 1),
(3, 9, 'Renteng (10 sch)', 10.000, 14000.00, '899275311201-RTG', 1),
(4, 9, 'Dus (120 sch)', 120.000, 160000.00, '899275311201-DUS', 1),
(5, 4, '1/2 kg', 0.500, 14500.00, '899123456004-SET', 1),
(6, 4, '1/4 kg', 0.250, 7500.00, '899123456004-PRP', 1),
(7, 1, 'Karung 25kg', 25.000, 365000.00, '899123456001-KRG', 1),
(8, 8, 'Dus (24 btl)', 24.000, 72000.00, '899990900101-DUS', 1)
ON CONFLICT (id) DO UPDATE SET
    unit_name = EXCLUDED.unit_name,
    conversion_factor = EXCLUDED.conversion_factor,
    sell_price = EXCLUDED.sell_price;

SELECT setval('product_units_id_seq', (SELECT MAX(id) FROM product_units));

-- 6. ALTERNATIF BARCODE (PRODUCT_BARCODES)
INSERT INTO product_barcodes (id, product_id, unit_id, barcode, notes) VALUES
(1, 6, 1, '8998866200220', 'Barcode box Indomie'),
(2, 9, 3, '8992753112010', 'Barcode renceng Kapal Api')
ON CONFLICT (id) DO NOTHING;

SELECT setval('product_barcodes_id_seq', (SELECT MAX(id) FROM product_barcodes));
