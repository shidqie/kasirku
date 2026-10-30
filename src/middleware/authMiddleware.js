const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SESSION_SECRET || 'kasirku_secret_fallback_key';

function extractUser(req) {
  // 1. Cek session Express jika ada
  if (req.session && req.session.user) {
    return req.session.user;
  }

  // 2. Cek Cookie JWT (kasirku_session)
  const token = req.cookies?.kasirku_session || 
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
      ? req.headers.authorization.slice(7).trim() 
      : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.session = req.session || {};
      req.session.user = decoded;
      req.user = decoded;
      return decoded;
    } catch (err) {
      // Token tidak valid atau kedaluwarsa
      return null;
    }
  }

  return null;
}

function isApiRequest(req) {
  const url = req.originalUrl || req.baseUrl || req.path || '';
  return (
    url.startsWith('/api/') ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json'))
  );
}

function requireAuth(req, res, next) {
  const user = extractUser(req);
  if (user) {
    return next();
  }

  // Jika permintaan API (JSON)
  if (isApiRequest(req)) {
    return res.status(401).json({
      success: false,
      message: 'Sesi login telah berakhir. Silakan login kembali.'
    });
  }

  // Jika permintaan view HTML
  res.redirect('/login');
}

function redirectIfAuth(req, res, next) {
  const user = extractUser(req);
  if (user) {
    const target = user.role === 'pemilik' ? '/' : '/kasir';
    return res.redirect(target);
  }
  next();
}

function requirePemilik(req, res, next) {
  const user = extractUser(req);
  if (user && user.role === 'pemilik') {
    return next();
  }

  if (isApiRequest(req)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Pemilik Toko.'
    });
  }

  res.redirect('/kasir');
}

module.exports = {
  extractUser,
  requireAuth,
  redirectIfAuth,
  requirePemilik
};
