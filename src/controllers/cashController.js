const { getDatabase } = require('../config/database');
const { cashFlowSchema, validateBody } = require('../utils/validation');

async function getCashSummary(req, res) {
  try {
    const db = await getDatabase();

    // 1. Total Penjualan Tunai Hari Ini (kompatibel PostgreSQL & SQLite)
    const [salesRows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_cash_sales, COUNT(id) AS tx_cash_count
      FROM transactions
      WHERE DATE(transaction_date) = CURRENT_DATE
        AND payment_method = 'cash'
    `);
    const totalCashSales = parseFloat(salesRows[0]?.total_cash_sales) || 0;
    const txCashCount = parseInt(salesRows[0]?.tx_cash_count) || 0;

    // 2. Total Penjualan QRIS / Non-Tunai Hari Ini
    const [nonCashRows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_non_cash, COUNT(id) AS tx_non_cash_count
      FROM transactions
      WHERE DATE(transaction_date) = CURRENT_DATE
        AND payment_method != 'cash'
    `);
    const totalNonCash = parseFloat(nonCashRows[0]?.total_non_cash) || 0;
    const txNonCashCount = parseInt(nonCashRows[0]?.tx_non_cash_count) || 0;

    // 3. Arus Kas (Modal Awal, Kas Masuk, Kas Keluar) Hari Ini
    const [flowRows] = await db.query(`
      SELECT 
        type,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM cash_flows
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY type
    `);

    let totalModalAwal = 0;
    let totalKasMasuk = 0;
    let totalKasKeluar = 0;

    flowRows.forEach(row => {
      if (row.type === 'modal_awal') totalModalAwal = parseFloat(row.total_amount) || 0;
      if (row.type === 'kas_masuk') totalKasMasuk = parseFloat(row.total_amount) || 0;
      if (row.type === 'kas_keluar') totalKasKeluar = parseFloat(row.total_amount) || 0;
    });

    const expectedDrawerCash = totalModalAwal + totalCashSales + totalKasMasuk - totalKasKeluar;

    // Riwayat Arus Kas Hari Ini
    const [recentFlows] = await db.query(`
      SELECT cf.*, u.name AS user_name
      FROM cash_flows cf
      LEFT JOIN users u ON cf.user_id = u.id
      WHERE DATE(cf.created_at) = CURRENT_DATE
      ORDER BY cf.id DESC
    `);

    res.json({
      success: true,
      data: {
        total_modal_awal: totalModalAwal,
        total_cash_sales: totalCashSales,
        tx_cash_count: txCashCount,
        total_non_cash_sales: totalNonCash,
        tx_non_cash_count: txNonCashCount,
        total_kas_masuk: totalKasMasuk,
        total_kas_keluar: totalKasKeluar,
        expected_drawer_cash: Math.max(0, expectedDrawerCash),
        recent_flows: recentFlows
      }
    });
  } catch (err) {
    console.error('Error getCashSummary:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat ringkasan arus kas.' });
  }
}

async function recordCashFlow(req, res) {
  try {
    const validatedData = validateBody(cashFlowSchema, req.body);
    const { type, amount, category, notes } = validatedData;
    const numAmount = parseFloat(amount);

    const db = await getDatabase();
    const userId = req.body.user_id ? parseInt(req.body.user_id) : (req.session?.user?.id || req.user?.id || 1);

    await db.query(`
      INSERT INTO cash_flows (user_id, type, amount, category, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      type,
      numAmount,
      category || 'operasional',
      notes || ''
    ]);

    let typeText = 'Modal Awal';
    if (type === 'kas_masuk') typeText = 'Kas Masuk';
    if (type === 'kas_keluar') typeText = 'Kas Keluar (Operasional)';

    res.status(201).json({
      success: true,
      message: `${typeText} sebesar Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat.`
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Error recordCashFlow:', err);
    res.status(500).json({ success: false, message: 'Gagal mencatat arus kas.' });
  }
}

module.exports = {
  getCashSummary,
  recordCashFlow
};
