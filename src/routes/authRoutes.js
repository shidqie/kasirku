const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requirePemilik } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.get('/cashiers', requireAuth, authController.getCashiers);
router.post('/password', requireAuth, authController.updatePassword);

// Manajemen Pengguna (Khusus Pemilik)
router.get('/users', requireAuth, requirePemilik, authController.getUsers);
router.post('/users', requireAuth, requirePemilik, authController.createUser);
router.delete('/users/:id', requireAuth, requirePemilik, authController.deleteUser);

module.exports = router;
