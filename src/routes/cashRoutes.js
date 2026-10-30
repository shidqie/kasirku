const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/summary', requireAuth, cashController.getCashSummary);
router.post('/flow', requireAuth, cashController.recordCashFlow);

module.exports = router;
