const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/summary', requireAuth, stockController.getStockSummary);
router.get('/movements', requireAuth, stockController.getStockMovements);
router.post('/entries', requireAuth, stockController.createStockEntry);
router.post('/adjust', requireAuth, stockController.adjustStock);

module.exports = router;
