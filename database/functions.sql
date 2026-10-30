-- ============================================================================
-- DATABASE FUNCTIONS & RPC: KasirKu
-- Engine: Supabase PostgreSQL
-- ============================================================================

-- 1. FUNGSI AUTO UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk tabel yang memiliki kolom updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON store_settings;
CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. FUNGSI ATOMIK TRANSAKSI PENJUALAN & PEMOTONGAN STOK (RPC)
-- Memastikan pemotongan stok, pencatatan transaksi, detail, dan mutasi stok berjalan secara ACID.
-- Jika stok tidak cukup atau saldo negatif, seluruh operasi otomatis ROLLBACK.
CREATE OR REPLACE FUNCTION process_sale_transaction(payload JSONB)
RETURNS JSONB AS $$
DECLARE
    v_invoice_number VARCHAR(50);
    v_cashier_id INTEGER;
    v_cashier_name VARCHAR(100);
    v_payment_method VARCHAR(20);
    v_cash_received NUMERIC(12, 2);
    v_notes TEXT;
    v_items JSONB;
    v_item JSONB;
    
    v_product_id INTEGER;
    v_unit_id INTEGER;
    v_qty NUMERIC(12, 2);
    v_conversion_factor NUMERIC(10, 3);
    v_base_qty NUMERIC(12, 2);
    v_unit_price NUMERIC(12, 2);
    v_subtotal NUMERIC(12, 2);
    v_total_amount NUMERIC(12, 2) := 0.00;
    v_change_amount NUMERIC(12, 2) := 0.00;
    
    v_prod RECORD;
    v_unit RECORD;
    v_tx_id INTEGER;
    v_unit_name VARCHAR(30);
    v_new_balance NUMERIC(12, 2);
BEGIN
    -- Ekstrak data utama dari payload
    v_invoice_number := payload->>'invoice_number';
    v_cashier_id     := (payload->>'cashier_id')::INTEGER;
    v_cashier_name   := COALESCE(payload->>'cashier_name', 'Kasir');
    v_payment_method := COALESCE(payload->>'payment_method', 'cash');
    v_cash_received  := (payload->>'cash_received')::NUMERIC;
    v_notes          := payload->>'notes';
    v_items          := payload->'items';

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Keranjang belanja tidak boleh kosong.';
    END IF;

    -- Validasi awal & Hitung ulang total di sisi database
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'product_id')::INTEGER;
        v_qty        := (v_item->>'quantity')::NUMERIC;
        v_unit_id    := NULLIF(v_item->>'unit_id', '')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Jumlah pembelian harus lebih dari 0.';
        END IF;

        -- Kunci baris produk dengan FOR UPDATE untuk mencegah race condition stok
        SELECT * INTO v_prod FROM products WHERE id = v_product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan.', v_product_id;
        END IF;

        IF v_prod.is_active = 0 THEN
            RAISE EXCEPTION 'Produk % sedang nonaktif dan tidak dapat dijual.', v_prod.name;
        END IF;

        -- Cek apakah menggunakan multi-satuan
        IF v_unit_id IS NOT NULL THEN
            SELECT * INTO v_unit FROM product_units WHERE id = v_unit_id AND product_id = v_product_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Satuan khusus untuk produk % tidak valid.', v_prod.name;
            END IF;
            v_conversion_factor := v_unit.conversion_factor;
            v_unit_price        := v_unit.sell_price;
        ELSE
            v_conversion_factor := 1.000;
            v_unit_price        := v_prod.sell_price;
        END IF;

        -- Jika ada harga custom/override dari kasir yang valid
        IF v_item->>'unit_price' IS NOT NULL AND (v_item->>'unit_price')::NUMERIC > 0 THEN
            v_unit_price := (v_item->>'unit_price')::NUMERIC;
        END IF;

        v_base_qty := v_qty * v_conversion_factor;

        IF v_prod.stock < v_base_qty THEN
            RAISE EXCEPTION 'Stok tidak mencukupi untuk %! Sisa stok: % %, Dibutuhkan: % %.',
                v_prod.name, v_prod.stock, v_prod.base_unit, v_base_qty, v_prod.base_unit;
        END IF;

        v_subtotal     := v_qty * v_unit_price;
        v_total_amount := v_total_amount + v_subtotal;
    END LOOP;

    -- Validasi uang tunai yang diterima
    IF v_cash_received < v_total_amount THEN
        RAISE EXCEPTION 'Uang yang diterima (Rp %) kurang dari total belanja (Rp %).', 
            v_cash_received, v_total_amount;
    END IF;

    v_change_amount := v_cash_received - v_total_amount;

    -- 1. Insert header transaksi
    INSERT INTO transactions (
        invoice_number, transaction_date, cashier_id, cashier_name,
        total_amount, cash_received, change_amount, payment_method, notes
    ) VALUES (
        v_invoice_number, NOW(), v_cashier_id, v_cashier_name,
        v_total_amount, v_cash_received, v_change_amount, v_payment_method, v_notes
    ) RETURNING id INTO v_tx_id;

    -- 2. Proses detail transaksi, pemotongan stok, dan mutasi
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'product_id')::INTEGER;
        v_qty        := (v_item->>'quantity')::NUMERIC;
        v_unit_id    := NULLIF(v_item->>'unit_id', '')::INTEGER;

        SELECT * INTO v_prod FROM products WHERE id = v_product_id;

        IF v_unit_id IS NOT NULL THEN
            SELECT * INTO v_unit FROM product_units WHERE id = v_unit_id;
            v_conversion_factor := v_unit.conversion_factor;
            v_unit_name         := v_unit.unit_name;
            v_unit_price        := v_unit.sell_price;
        ELSE
            v_conversion_factor := 1.000;
            v_unit_name         := v_prod.base_unit;
            v_unit_price        := v_prod.sell_price;
        END IF;

        IF v_item->>'unit_price' IS NOT NULL AND (v_item->>'unit_price')::NUMERIC > 0 THEN
            v_unit_price := (v_item->>'unit_price')::NUMERIC;
        END IF;

        v_base_qty := v_qty * v_conversion_factor;
        v_subtotal := v_qty * v_unit_price;
        v_new_balance := v_prod.stock - v_base_qty;

        -- Simpan snapshot detail
        INSERT INTO transaction_details (
            transaction_id, product_id, unit_id, product_name_snapshot,
            unit_snapshot, quantity, conversion_factor_snapshot, base_quantity,
            cost_price_snapshot, unit_price, subtotal
        ) VALUES (
            v_tx_id, v_product_id, v_unit_id, v_prod.name,
            v_unit_name, v_qty, v_conversion_factor, v_base_qty,
            v_prod.cost_price, v_unit_price, v_subtotal
        );

        -- Kurangi stok produk secara langsung
        UPDATE products 
        SET stock = v_new_balance, updated_at = NOW() 
        WHERE id = v_product_id;

        -- Catat pada tabel riwayat pergerakan stok (stock_movements)
        INSERT INTO stock_movements (
            product_id, movement_date, type, quantity, balance_after, reference_id, notes
        ) VALUES (
            v_product_id, NOW(), 'penjualan', -v_base_qty, v_new_balance,
            v_invoice_number, 'Penjualan No. ' || v_invoice_number || ' (' || v_qty || ' ' || v_unit_name || ')'
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transaksi berhasil disimpan dan stok otomatis terpotong.',
        'transaction_id', v_tx_id,
        'invoice_number', v_invoice_number,
        'total_amount', v_total_amount,
        'cash_received', v_cash_received,
        'change_amount', v_change_amount
    );
END;
$$ LANGUAGE plpgsql;
