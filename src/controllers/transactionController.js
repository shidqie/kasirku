const { getDatabase } = require('../config/database');
const { transactionSchema, validateBody } = require('../utils/validation');

/**
 * Generate Invoice Number: TRX-YYYYMMDD-0001
 */
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${year}${month}${day}-${randomSuffix}`;
}

async function createTransaction(req, res) {
  try {
    // 1. Validasi input dengan Zod
    const validatedData = validateBody(transactionSchema, req.body);
    const { items, cash_received, payment_method, notes, cashier_id, cashier_name, customer_name } = validatedData;

    const db = await getDatabase();
    const cashierId = cashier_id || (req.session?.user?.id || req.user?.id || 1);
    const cashierName = (cashier_name && cashier_name.trim()) 
      ? cashier_name.trim() 
      : (req.session?.user?.name || req.user?.name || 'Kasir');
    const customerName = (customer_name && customer_name.trim()) ? customer_name.trim() : 'Umum';

    // 2. Validasi ketersediaan produk, multi-satuan, dan stok dasar
    const productCheckPromises = items.map(async (item) => {
      const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (rows.length === 0) {
        throw new Error(`Produk dengan ID #${item.product_id} tidak ditemukan.`);
      }
      const prod = rows[0];
      if (!prod.is_active) {
        throw new Error(`Produk '${prod.name}' berstatus nonaktif dan tidak dapat dijual.`);
      }

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Jumlah untuk '${prod.name}' harus lebih dari 0.`);
      }

      let conversionFactor = 1.0;
      let unitName = item.unit || prod.base_unit;
      let unitPrice = parseFloat(item.unit_price) || prod.sell_price;

      // Cek apakah item memilih multi-satuan (product_units)
      if (item.unit_id) {
        const [unitRows] = await db.query(
          'SELECT * FROM product_units WHERE id = ? AND product_id = ?',
          [item.unit_id, prod.id]
        );
        if (unitRows.length > 0) {
          const u = unitRows[0];
          conversionFactor = parseFloat(u.conversion_factor) || 1.0;
          unitName = u.unit_name;
          unitPrice = parseFloat(item.unit_price) || u.sell_price;
        }
      }

      const baseQuantity = qty * conversionFactor;

      if (prod.stock < baseQuantity) {
        throw new Error(
          `Stok tidak mencukupi untuk '${prod.name}'. Sisa stok: ${prod.stock} ${prod.base_unit}, dibutuhkan: ${baseQuantity} ${prod.base_unit}.`
        );
      }

      return {
        product: prod,
        requestedQty: qty,
        unit_id: item.unit_id || null,
        conversionFactor,
        baseQuantity,
        unit: unitName,
        price: unitPrice
      };
    });

    let validatedItems;
    try {
      validatedItems = await Promise.all(productCheckPromises);
    } catch (validationErr) {
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    // 3. Hitung total tagihan dari harga backend
    let totalAmount = 0;
    validatedItems.forEach(item => {
      totalAmount += item.requestedQty * item.price;
    });

    const parsedCashReceived = parseFloat(cash_received);
    if (isNaN(parsedCashReceived) || parsedCashReceived < totalAmount) {
      return res.status(400).json({
        success: false,
        message: `Uang yang diterima (Rp ${parsedCashReceived.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${totalAmount.toLocaleString('id-ID')}).`
      });
    }

    const changeAmount = parsedCashReceived - totalAmount;
    const invoiceNumber = generateInvoiceNumber();

    // 4. Eksekusi Atomic Transaction (ACID)
    const transactionResult = await db.transaction(async (conn) => {
      // Simpan header transaksi
      const [txResult] = await conn.query(
        `INSERT INTO transactions 
         (invoice_number, transaction_date, cashier_id, cashier_name, customer_name, total_amount, cash_received, change_amount, payment_method, notes) 
         VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber,
          cashierId,
          cashierName,
          customerName,
          totalAmount,
          parsedCashReceived,
          changeAmount,
          payment_method || 'cash',
          notes || null
        ]
      );

      const transactionId = txResult.insertId;

      // Simpan detail transaksi dan kurangi stok produk
      for (const item of validatedItems) {
        const itemSubtotal = item.requestedQty * item.price;
        const newBalance = item.product.stock - item.baseQuantity;

        // Insert detail transaksi
        await conn.query(
          `INSERT INTO transaction_details 
           (transaction_id, product_id, unit_id, product_name_snapshot, unit_snapshot, quantity, conversion_factor_snapshot, base_quantity, cost_price_snapshot, unit_price, subtotal) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            item.product.id,
            item.unit_id,
            item.product.name,
            item.unit,
            item.requestedQty,
            item.conversionFactor,
            item.baseQuantity,
            item.product.cost_price,
            item.price,
            itemSubtotal
          ]
        );

        // Update stok produk secara otomatis
        await conn.query(
          'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newBalance, item.product.id]
        );

        // Catat mutasi stok
        await conn.query(
          `INSERT INTO stock_movements 
           (product_id, movement_date, type, quantity, balance_after, reference_id, notes) 
           VALUES (?, CURRENT_TIMESTAMP, 'penjualan', ?, ?, ?, ?)`,
          [
            item.product.id,
            -item.baseQuantity,
            newBalance,
            invoiceNumber,
            `Penjualan No. ${invoiceNumber} (${item.requestedQty} ${item.unit})`
          ]
        );
      }

      return {
        transactionId,
        invoiceNumber,
        totalAmount,
        cashReceived: parsedCashReceived,
        changeAmount
      };
    });

    // Ambil data toko untuk cetak struk
    const [storeRows] = await db.query('SELECT * FROM store_settings LIMIT 1');
    const store = storeRows[0] || {};

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan.',
      data: {
        invoice_number: invoiceNumber,
        date: new Date().toISOString(),
        cashier_id: cashierId,
        cashier_name: cashierName,
        customer_name: customerName,
        items: validatedItems.map(i => ({
          name: i.product.name,
          quantity: i.requestedQty,
          unit: i.unit,
          price: i.price,
          subtotal: i.requestedQty * i.price
        })),
        total_amount: totalAmount,
        cash_received: parsedCashReceived,
        change_amount: changeAmount,
        payment_method: payment_method || 'cash',
        store: store
      }
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('createTransaction error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses transaksi: ' + err.message });
  }
}

async function getTransactions(req, res) {
  try {
    const { start_date, end_date, q, page = 1, limit = 50 } = req.query;
    const db = await getDatabase();

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let sql = `SELECT * FROM transactions WHERE 1=1`;
    const params = [];

    if (start_date) {
      sql += ` AND DATE(transaction_date) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(transaction_date) <= ?`;
      params.push(end_date);
    }
    if (q) {
      sql += ` AND (invoice_number LIKE ? OR cashier_name LIKE ? OR customer_name LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY transaction_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar transaksi.' });
  }
}

async function getTransactionDetail(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const [txRows] = await db.query('SELECT * FROM transactions WHERE id = ? OR invoice_number = ? LIMIT 1', [id, id]);
    if (txRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const transaction = txRows[0];
    const [detailRows] = await db.query(
      `SELECT td.*, p.code AS product_code 
       FROM transaction_details td
       LEFT JOIN products p ON td.product_id = p.id
       WHERE td.transaction_id = ?`,
      [transaction.id]
    );

    const [storeRows] = await db.query('SELECT * FROM store_settings LIMIT 1');

    res.json({
      success: true,
      data: {
        ...transaction,
        items: detailRows,
        store: storeRows[0] || {}
      }
    });
  } catch (err) {
    console.error('getTransactionDetail error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail transaksi.' });
  }
}

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionDetail
};
