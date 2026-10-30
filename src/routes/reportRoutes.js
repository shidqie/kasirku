const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/dashboard', requireAuth, reportController.getDashboardStats);
router.get('/sales', requireAuth, reportController.getSalesReport);
router.get('/export-csv', requireAuth, reportController.exportSalesCsv);

module.exports = router;
