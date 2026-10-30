const app = require('./src/app');
const { getDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Inisialisasi Database (MySQL dengan auto-fallback SQLite)
    await getDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
============================================================
🚀 KASIRKU - Sistem Kasir Toko Kelontong Berjalan!
============================================================
📡 URL Aplikasi: http://localhost:${PORT}
🔑 Akun Default:
   Username: kasir
   Password: kasir123
📱 Mode: Mobile-First PWA & Desktop Kasir
============================================================
`);
    });
  } catch (err) {
    console.error('❌ Gagal menjalankan server:', err);
    process.exit(1);
  }
}

startServer();
