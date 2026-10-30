/**
 * Service untuk menangani pencatatan mutasi stok produk secara konsisten
 */

async function logMovement(db, { productId, type, quantity, balanceAfter, referenceId = null, notes = '' }) {
  await db.query(
    `INSERT INTO stock_movements 
     (product_id, movement_date, type, quantity, balance_after, reference_id, notes) 
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
    [productId, type, quantity, balanceAfter, referenceId, notes]
  );
}

module.exports = {
  logMovement
};
