const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyToken = require('../middlewares/verifyToken');

// Protected routes (authentication required)
router.post('/create', verifyToken, paymentController.createPayment);
router.get('/history', verifyToken, paymentController.getUserPayments);
router.get('/:paymentId', verifyToken, paymentController.getPaymentById);
router.put('/:paymentId/status', verifyToken, paymentController.updatePaymentStatus);

// Webhook route (no authentication required - payment gateway calls this)
router.post('/webhook', paymentController.processPaymentWebhook);

// Admin routes (protected + admin access required)
router.get('/admin/all', verifyToken, paymentController.getAllPayments);
router.get('/admin/stats', verifyToken, paymentController.getPaymentStats);

module.exports = router; 