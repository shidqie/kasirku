const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public/POS Product queries
router.get('/', requireAuth, productController.getProducts);
router.get('/barcode/:code', requireAuth, productController.getProductByBarcode);
router.get('/categories', requireAuth, productController.getCategories);
router.post('/categories', requireAuth, productController.createCategory);
router.get('/settings/store', requireAuth, productController.getStoreSettings);
router.put('/settings/store', requireAuth, productController.updateStoreSettings);
router.get('/next-code', requireAuth, productController.getNextCode);

// Multi-satuan produk
router.get('/:id/units', requireAuth, productController.getProductUnits);
router.post('/:id/units', requireAuth, productController.createProductUnit);
router.delete('/units/:unitId', requireAuth, productController.deleteProductUnit);

// Operasi CRUD Produk
router.get('/:id', requireAuth, productController.getProductById);
router.post('/', requireAuth, productController.createProduct);
router.put('/:id', requireAuth, productController.updateProduct);
router.patch('/:id/toggle-status', requireAuth, productController.toggleProductStatus);

module.exports = router;
