const { getDatabase } = require('../config/database');

async function getDashboardStats(req, res) {
  try {
    const db = await getDatabase();

    // 1. Penjualan & Transaksi Hari Ini
    const [todaySalesRows] = await db.query(
      `SELECT 
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS total_revenue 
       FROM transactions 
       WHERE DATE(transaction_date) = CURRENT_DATE`
    );

    // 2. Total Produk Aktif
    const [productCountRows] = await db.query(
      'SELECT COUNT(*) AS count FROM products WHERE is_active = 1'
    );

    // 3. Jumlah Produk Stok Menipis
    const [lowStockRows] = await db.query(
      'SELECT COUNT(*) AS count FROM products WHERE stock <= min_stock AND is_active = 1'
    );

    // 4. Transaksi Terbaru (5 transaksi terakhir)
    const [recentTxRows] = await db.query(
      'SELECT * FROM transactions ORDER BY transaction_date DESC LIMIT 5'
    );

    // 5. Produk Terlaris (Top 5)
    const [topProductsRows] = await db.query(
      `SELECT 
         td.product_name_snapshot AS name,
         td.unit_snapshot AS unit,
         SUM(td.quantity) AS total_qty_sold,
         SUM(td.subtotal) AS total_sales_amount
       FROM transaction_details td
       GROUP BY td.product_id, td.product_name_snapshot, td.unit_snapshot
       ORDER BY total_qty_sold DESC
       LIMIT 5`
    );

    // 6. Daftar item dengan stok menipis untuk peringatan dashboard
    const [lowStockItems] = await db.query(
      `SELECT id, name, code, stock, min_stock, base_unit 
       FROM products 
       WHERE stock <= min_stock AND is_active = 1 
       ORDER BY stock ASC LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        today_revenue: todaySalesRows[0]?.total_revenue || 0,
        today_transactions_count: todaySalesRows[0]?.count || 0,
        total_products: productCountRows[0]?.count || 0,
        low_stock_count: lowStockRows[0]?.count || 0,
        recent_transactions: recentTxRows,
        top_selling_products: topProductsRows,
        low_stock_warnings: lowStockItems
      }
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil statistik dashboard.' });
  }
}

async function getSalesReport(req, res) {
  try {
    const { start_date, end_date, cashier_id } = req.query;
    const db = await getDatabase();

    let sql = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM transaction_details td WHERE td.transaction_id = t.id) AS total_items_count
      FROM transactions t 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ` AND DATE(t.transaction_date) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(t.transaction_date) <= ?`;
      params.push(end_date);
    }
    if (cashier_id) {
      sql += ` AND t.cashier_id = ?`;
      params.push(cashier_id);
    }

    sql += ` ORDER BY t.transaction_date DESC`;

    const [transactions] = await db.query(sql, params);

    // Hitung ringkasan total omzet dan perkiraan laba kotor
    let totalRevenue = 0;
    transactions.forEach(t => {
      totalRevenue += parseFloat(t.total_amount) || 0;
    });

    // Hitung total laba kotor dari detail
    let profitSql = `
      SELECT 
        SUM(td.subtotal) AS total_sales,
        SUM(td.quantity * td.cost_price_snapshot) AS total_cost
      FROM transaction_details td
      JOIN transactions t ON td.transaction_id = t.id
      WHERE 1=1
    `;
    const profitParams = [];
    if (start_date) {
      profitSql += ` AND DATE(t.transaction_date) >= ?`;
      profitParams.push(start_date);
    }
    if (end_date) {
      profitSql += ` AND DATE(t.transaction_date) <= ?`;
      profitParams.push(end_date);
    }
    if (cashier_id) {
      profitSql += ` AND t.cashier_id = ?`;
      profitParams.push(cashier_id);
    }

    const [profitRows] = await db.query(profitSql, profitParams);
    const totalCost = parseFloat(profitRows[0]?.total_cost) || 0;
    const grossProfit = totalRevenue - totalCost;

    res.json({
      success: true,
      data: {
        summary: {
          transaction_count: transactions.length,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          gross_profit: grossProfit
        },
        transactions
      }
    });
  } catch (err) {
    console.error('getSalesReport error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghasilkan laporan penjualan.' });
  }
}

async function exportSalesCsv(req, res) {
  try {
    const { start_date, end_date, cashier_id } = req.query;
    const db = await getDatabase();

    let sql = `
      SELECT 
        t.invoice_number,
        t.transaction_date,
        t.cashier_name,
        td.product_name_snapshot,
        td.quantity,
        td.unit_snapshot,
        td.unit_price,
        td.subtotal,
        t.total_amount,
        t.payment_method
      FROM transactions t
      JOIN transaction_details td ON t.id = td.transaction_id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ` AND DATE(t.transaction_date) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(t.transaction_date) <= ?`;
      params.push(end_date);
    }
    if (cashier_id) {
      sql += ` AND t.cashier_id = ?`;
      params.push(cashier_id);
    }

    sql += ` ORDER BY t.transaction_date DESC`;

    const [rows] = await db.query(sql, params);

    // Format CSV
    const headers = ['No. Invoice', 'Tanggal & Waktu', 'Kasir', 'Nama Produk', 'Jumlah', 'Satuan', 'Harga Satuan', 'Subtotal Item', 'Total Transaksi', 'Metode Bayar'];
    let csvContent = headers.join(',') + '\n';

    rows.forEach(r => {
      const line = [
        `"${r.invoice_number}"`,
        `"${r.transaction_date}"`,
        `"${r.cashier_name}"`,
        `"${r.product_name_snapshot.replace(/"/g, '""')}"`,
        r.quantity,
        `"${r.unit_snapshot}"`,
        r.unit_price,
        r.subtotal,
        r.total_amount,
        `"${r.payment_method}"`
      ];
      csvContent += line.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Laporan_Penjualan_KasirKu_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('exportSalesCsv error:', err);
    res.status(500).send('Gagal mengekspor CSV.');
  }
}

module.exports = {
  getDashboardStats,
  getSalesReport,
  exportSalesCsv
};
