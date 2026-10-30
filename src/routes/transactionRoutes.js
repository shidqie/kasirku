const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, transactionController.createTransaction);
router.get('/', requireAuth, transactionController.getTransactions);
router.get('/:id', requireAuth, transactionController.getTransactionDetail);

module.exports = router;
