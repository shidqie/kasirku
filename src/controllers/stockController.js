const { getDatabase } = require('../config/database');
const { stockEntrySchema, stockAdjustmentSchema, validateBody } = require('../utils/validation');

/**
 * Catat Stok Masuk dari Pembelian / Penerimaan Barang (Supplier)
 */
async function createStockEntry(req, res) {
  try {
    const validatedData = validateBody(stockEntrySchema, req.body);
    const { supplier_name, items, notes } = validatedData;

    const db = await getDatabase();
    const entryNumber = `IN-${Date.now()}`;

    let totalCost = 0;
    const validatedItems = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const unitCost = parseFloat(item.unit_cost) || 0;

      const [pRows] = await db.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (pRows.length === 0) {
        return res.status(400).json({ success: false, message: `Produk ID #${item.product_id} tidak ditemukan.` });
      }

      const subtotal = qty * unitCost;
      totalCost += subtotal;

      validatedItems.push({
        product: pRows[0],
        quantity: qty,
        unitCost,
        subtotal
      });
    }

    await db.transaction(async (conn) => {
      // Simpan header stok masuk
      const [entryResult] = await conn.query(
        `INSERT INTO stock_entries (entry_number, entry_date, supplier_name, total_cost, notes) 
         VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)`,
        [entryNumber, supplier_name || 'Supplier Umum', totalCost, notes || null]
      );

      const entryId = entryResult.insertId;

      // Simpan detail dan perbarui stok
      for (const item of validatedItems) {
        await conn.query(
          `INSERT INTO stock_entry_details (entry_id, product_id, quantity, unit_cost, subtotal) 
           VALUES (?, ?, ?, ?, ?)`,
          [entryId, item.product.id, item.quantity, item.unitCost, item.subtotal]
        );

        const newStock = item.product.stock + item.quantity;

        // Update harga beli jika diisi
        if (item.unitCost > 0) {
          await conn.query(
            'UPDATE products SET stock = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStock, item.unitCost, item.product.id]
          );
        } else {
          await conn.query(
            'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStock, item.product.id]
          );
        }

        // Catat mutasi stok
        await conn.query(
          `INSERT INTO stock_movements 
           (product_id, movement_date, type, quantity, balance_after, reference_id, notes) 
           VALUES (?, CURRENT_TIMESTAMP, 'stok_masuk', ?, ?, ?, ?)`,
          [
            item.product.id,
            item.quantity,
            newStock,
            entryNumber,
            `Penerimaan barang dari ${supplier_name || 'Supplier'}`
          ]
        );
      }
    });

    res.status(201).json({
      success: true,
      message: 'Stok masuk berhasil dicatat dan persediaan diperbarui.',
      entry_number: entryNumber
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('createStockEntry error:', err);
    res.status(500).json({ success: false, message: 'Gagal mencatat stok masuk.' });
  }
}

/**
 * Penyesuaian Stok (Stock Opname)
 */
async function adjustStock(req, res) {
  try {
    const validatedData = validateBody(stockAdjustmentSchema, req.body);
    const { product_id, actual_stock, notes } = validatedData;

    const parsedActual = parseFloat(actual_stock);

    const db = await getDatabase();
    const [pRows] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
    if (pRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const product = pRows[0];
    const diff = parsedActual - product.stock;

    if (diff === 0) {
      return res.json({ success: true, message: 'Stok fisik sama dengan stok sistem, tidak ada perubahan.' });
    }

    await db.transaction(async (conn) => {
      await conn.query(
        'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [parsedActual, product.id]
      );

      await conn.query(
        `INSERT INTO stock_movements 
         (product_id, movement_date, type, quantity, balance_after, reference_id, notes) 
         VALUES (?, CURRENT_TIMESTAMP, 'penyesuaian', ?, ?, ?, ?)`,
        [
          product.id,
          diff,
          parsedActual,
          `ADJ-${Date.now()}`,
          notes || 'Penyesuaian stok opname fisik'
        ]
      );
    });

    res.json({
      success: true,
      message: `Stok produk '${product.name}' berhasil disesuaikan dari ${product.stock} menjadi ${parsedActual} ${product.base_unit}.`
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('adjustStock error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyesuaikan stok.' });
  }
}

/**
 * Riwayat Mutasi Stok
 */
async function getStockMovements(req, res) {
  try {
    const { product_id, type, start_date, end_date } = req.query;
    const db = await getDatabase();

    let sql = `
      SELECT sm.*, p.name AS product_name, p.code AS product_code, p.base_unit 
      FROM stock_movements sm 
      JOIN products p ON sm.product_id = p.id 
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ` AND sm.product_id = ?`;
      params.push(product_id);
    }
    if (type) {
      sql += ` AND sm.type = ?`;
      params.push(type);
    }
    if (start_date) {
      sql += ` AND DATE(sm.movement_date) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(sm.movement_date) <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY sm.movement_date DESC LIMIT 100`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getStockMovements error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat mutasi stok.' });
  }
}

/**
 * Ringkasan Stok & Peringatan Stok Menipis
 */
async function getStockSummary(req, res) {
  try {
    const db = await getDatabase();

    // Produk stok menipis (<= min_stock)
    const [lowStock] = await db.query(
      `SELECT p.*, c.name AS category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.stock <= p.min_stock AND p.is_active = 1 
       ORDER BY p.stock ASC`
    );

    // Total nilai persediaan
    const [valRows] = await db.query(
      `SELECT 
         COUNT(*) AS total_items,
         SUM(stock * cost_price) AS total_inventory_cost,
         SUM(stock * sell_price) AS total_inventory_value 
       FROM products 
       WHERE is_active = 1`
    );

    res.json({
      success: true,
      data: {
        low_stock_items: lowStock,
        summary: valRows[0] || {}
      }
    });
  } catch (err) {
    console.error('getStockSummary error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan stok.' });
  }
}

module.exports = {
  createStockEntry,
  adjustStock,
  getStockMovements,
  getStockSummary
};
