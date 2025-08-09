const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const verifyToken = require('../middlewares/verifyToken');

// Protected routes (authentication required)
router.get('/my-subscription', verifyToken, subscriptionController.getUserSubscription);
router.get('/plans', subscriptionController.getSubscriptionPlans);
router.post('/subscribe', verifyToken, subscriptionController.subscribeToPlan);
router.post('/cancel', verifyToken, subscriptionController.cancelSubscription);
router.post('/renew', verifyToken, subscriptionController.renewSubscription);

router.post('/manual-payment', verifyToken, subscriptionController.manualPayment);
router.get('/admin/all-manual-payments', verifyToken, subscriptionController.getAllManualPayments);

// Admin routes (protected + admin access required)
router.get('/all', verifyToken, subscriptionController.getAllSubscriptions);
router.get('/:subscriptionId', verifyToken, subscriptionController.getSubscriptionById);
router.put('/:subscriptionId', verifyToken, subscriptionController.updateSubscription);
router.delete('/:subscriptionId', verifyToken, subscriptionController.deleteSubscription);
router.put('/:subscriptionId/status', verifyToken, subscriptionController.updateSubscriptionStatus);
router.get('/stats/overview', verifyToken, subscriptionController.getSubscriptionStats);

module.exports = router; 