/**
 * SLM MARKET - Product Routes
 * Placeholder — full implementation is in app.js (monolithic).
 * Refactor to use this file by extracting controllers from app.js.
 */

const express = require('express');
const router = express.Router();

// These routes are currently handled directly in app.js:
//   GET  /api/v1/products
//   GET  /api/v1/products/:id
//   POST /api/v1/products (vendor/admin only)

// Future split-file structure:
/*
const ProductController = require('../controllers/product.controller');
const { verifyToken }          = require('../middleware/auth');
const { authorize }            = require('../middleware/auth');
const { validateCreateProduct } = require('../middleware/validators');
const { apiLimiter }           = require('../middleware/rateLimiter');

router.get('/',    apiLimiter, ProductController.getProducts);
router.get('/:id', ProductController.getProduct);
router.post('/',   verifyToken, authorize('vendor', 'admin'), validateCreateProduct, ProductController.createProduct);
router.put('/:id', verifyToken, authorize('vendor', 'admin'), ProductController.updateProduct);
router.delete('/:id', verifyToken, authorize('admin'), ProductController.deleteProduct);

// Reviews sub-resource
router.post('/:id/reviews', verifyToken, ProductController.addReview);
router.get('/:id/reviews',  ProductController.getReviews);
*/

module.exports = router;