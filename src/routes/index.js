const express = require('express');
const router = express.Router();

const userRoutes = require('./user.route');
const channelRoutes = require('./channel.route');
const categoryRoutes = require('./category.route');
const subscriptionRoutes = require('./subscription.route');
const paymentRoutes = require('./payment.route');
const watchHistoryRoutes = require('./watchHistory.route');
const otpRoutes = require('./otp.route');

// API Routes
router.use('/user', userRoutes);
router.use('/channel', channelRoutes);
router.use('/category', categoryRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/payment', paymentRoutes);
router.use('/watch-history', watchHistoryRoutes);
router.use('/otp', otpRoutes);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'IPTV Backend API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

module.exports = router;
