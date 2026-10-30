const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const { requireAuth, redirectIfAuth } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const stockRoutes = require('./routes/stockRoutes');
const reportRoutes = require('./routes/reportRoutes');
const cashRoutes = require('./routes/cashRoutes');

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session fallback untuk local development
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kasirku_secret_fallback_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 jam
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Static assets (CSS, JS, icons, manifest, service worker)
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cash', cashRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'KasirKu',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// HTML PAGE ROUTES
// ==========================================
const viewsPath = path.join(__dirname, '../views');

// Halaman Login
app.get('/login', redirectIfAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'login.html'));
});

// Halaman Dashboard
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'dashboard.html'));
});

// Halaman Kasir / Transaksi Baru
app.get('/kasir', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'kasir.html'));
});

// Halaman Manajemen Produk & Kategori
app.get('/produk', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'produk.html'));
});

// Halaman Persediaan / Stok Masuk / Mutasi
app.get('/stok', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'stok.html'));
});

// Halaman Laporan Penjualan
app.get('/laporan', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'laporan.html'));
});

// Halaman Pengaturan Toko & Akun
app.get('/pengaturan', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsPath, 'pengaturan.html'));
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
  }
  res.status(404).sendFile(path.join(viewsPath, '404.html'));
});

module.exports = app;
