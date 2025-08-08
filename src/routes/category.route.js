const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const verifyToken = require('../middlewares/verifyToken');

// Public routes (no authentication required)
router.get('/', categoryController.getAllCategories);
router.get('/:categoryId', categoryController.getCategoryById);
router.get('/slug/:slug', categoryController.getCategoryBySlug);

// Admin routes (protected + admin access required)
router.post('/', verifyToken, categoryController.createCategory);
router.put('/:categoryId', verifyToken, categoryController.updateCategory);
router.delete('/:categoryId', verifyToken, categoryController.deleteCategory);
router.put('/:categoryId/status', verifyToken, categoryController.updateCategoryStatus);

module.exports = router;