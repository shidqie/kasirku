const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { loginSchema, validateBody } = require('../utils/validation');

const JWT_SECRET = process.env.SESSION_SECRET || 'kasirku_secret_fallback_key';

async function login(req, res) {
  try {
    const validatedData = validateBody(loginSchema, req.body);
    const { username, password } = validatedData;

    const db = await getDatabase();
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username.trim()]);
    
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password tidak sesuai.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password tidak sesuai.' });
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };

    // Set Express session
    if (req.session) {
      req.session.user = sessionUser;
    }

    // Buat JWT Token stateless untuk serverless Vercel
    const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: '7d' });

    // Set HTTP-Only Cookie
    res.cookie('kasirku_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    const redirectTo = user.role === 'pemilik' ? '/' : '/kasir';

    res.json({
      success: true,
      message: 'Login berhasil.',
      user: sessionUser,
      token,
      redirectTo
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
  }
}

async function logout(req, res) {
  res.clearCookie('kasirku_session', { path: '/' });
  res.clearCookie('connect.sid', { path: '/' });
  if (req.session) {
    req.session.destroy(() => {});
  }
  res.json({ success: true, message: 'Logout berhasil.' });
}

async function getMe(req, res) {
  const user = req.session?.user || req.user;
  if (user) {
    return res.json({ success: true, user });
  }
  res.status(401).json({ success: false, message: 'Belum login.' });
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    const db = await getDatabase();
    const userId = (req.session?.user || req.user).id;
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Password saat ini tidak sesuai.' });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHashed, userId]);

    res.json({ success: true, message: 'Password berhasil diperbarui.' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui password.' });
  }
}

// User Management (Khusus Pemilik)
async function getUsers(req, res) {
  try {
    const db = await getDatabase();
    const [rows] = await db.query('SELECT id, username, name, role, created_at FROM users ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar pengguna.' });
  }
}

async function createUser(req, res) {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: 'Username, password, dan nama wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const db = await getDatabase();
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan, silakan pilih username lain.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const assignedRole = role === 'pemilik' ? 'pemilik' : 'kasir';

    await db.query(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username.trim(), hashed, name.trim(), assignedRole]
    );

    res.status(201).json({
      success: true,
      message: `Pengguna ${name} (${assignedRole === 'pemilik' ? 'Pemilik' : 'Kasir'}) berhasil ditambahkan.`
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan pengguna baru.' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = (req.session?.user || req.user)?.id;
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
    }

    const db = await getDatabase();
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
}

// Mendapatkan daftar kasir/pengguna untuk dropdown kasir (bisa diakses kasir & pemilik)
async function getCashiers(req, res) {
  try {
    const db = await getDatabase();
    const [rows] = await db.query('SELECT id, username, name, role FROM users ORDER BY role ASC, name ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get cashiers error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar kasir.' });
  }
}

module.exports = {
  login,
  logout,
  getMe,
  updatePassword,
  getUsers,
  createUser,
  deleteUser,
  getCashiers
};
