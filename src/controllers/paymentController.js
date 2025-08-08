// controllers/paymentController.js
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const sendResponse = require('../utils/sendResponse');
const crypto = require('crypto');

// Create payment
exports.createPayment = async (req, res) => {
    try {
        const {
            subscription_type,
            subscription_duration,
            payment_method,
            amount,
            coupon_code
        } = req.body;

        // Validate required fields
        if (!subscription_type || !subscription_duration || !payment_method || !amount) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Subscription type, duration, payment method, and amount are required'
            });
        }

        // Validate subscription type
        if (!['basic', 'premium', 'vip'].includes(subscription_type)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid subscription type'
            });
        }

        // Validate duration
        if (![30, 90, 365].includes(subscription_duration)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid subscription duration'
            });
        }

        // Validate payment method
        if (!['bkash', 'nagad', 'rocket', 'card'].includes(payment_method)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid payment method'
            });
        }

        // Generate unique transaction ID
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Calculate discount if coupon code provided
        let discountAmount = 0;
        if (coupon_code) {
            // Implement coupon validation logic here
            // For now, we'll use a simple 10% discount for demo
            discountAmount = amount * 0.1;
        }

        const payment = new Payment({
            user_id: req.user.userId,
            transaction_id: transactionId,
            amount,
            payment_method,
            subscription_duration,
            subscription_type,
            coupon_code: coupon_code || null,
            discount_amount: discountAmount,
            currency: 'BDT'
        });

        await payment.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Payment created successfully',
            data: {
                payment,
                payment_url: generatePaymentUrl(payment, payment_method)
            }
        });

    } catch (error) {
        console.error('Create payment error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating payment'
        });
    }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;

        const payment = await Payment.findById(paymentId)
            .populate('user_id', 'name email sid')
            .populate('subscription_id');

        if (!payment) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Payment not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Payment retrieved successfully',
            data: payment
        });

    } catch (error) {
        console.error('Get payment error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving payment'
        });
    }
};

// Get user's payment history
exports.getUserPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const skip = (page - 1) * limit;

        const query = { user_id: req.user.userId };
        if (status) {
            query.payment_status = status;
        }

        const payments = await Payment.find(query)
            .populate('subscription_id')
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Payment.countDocuments(query);

        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_records: total,
            per_page: parseInt(limit)
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Payment history retrieved successfully',
            data: payments,
            pagination
        });

    } catch (error) {
        console.error('Get user payments error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving payment history'
        });
    }
};

// Update payment status (for payment gateway webhook)
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { payment_status, bkash_transaction_id, gateway_response } = req.body;

        if (!['pending', 'completed', 'failed', 'refunded', 'cancelled'].includes(payment_status)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid payment status'
            });
        }

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Payment not found'
            });
        }

        // Update payment
        payment.payment_status = payment_status;
        if (bkash_transaction_id) payment.bkash_transaction_id = bkash_transaction_id;
        if (gateway_response) payment.gateway_response = gateway_response;
        
        if (payment_status === 'completed') {
            payment.payment_date = new Date();
        }

        await payment.save();

        // If payment is completed, create/update subscription
        if (payment_status === 'completed') {
            await createOrUpdateSubscription(payment);
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Payment status updated successfully',
            data: payment
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating payment status'
        });
    }
};

// Process payment webhook
exports.processPaymentWebhook = async (req, res) => {
    try {
        const { 
            transaction_id, 
            payment_status, 
            bkash_transaction_id,
            amount,
            gateway_response 
        } = req.body;

        // Verify webhook signature (implement based on your payment gateway)
        // const isValidSignature = verifyWebhookSignature(req);
        // if (!isValidSignature) {
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        const payment = await Payment.findOne({ transaction_id });
        if (!payment) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Payment not found'
            });
        }

        // Update payment status
        payment.payment_status = payment_status;
        if (bkash_transaction_id) payment.bkash_transaction_id = bkash_transaction_id;
        if (gateway_response) payment.gateway_response = gateway_response;

        if (payment_status === 'completed') {
            payment.payment_date = new Date();
        }

        await payment.save();

        // If payment is completed, create/update subscription
        if (payment_status === 'completed') {
            await createOrUpdateSubscription(payment);
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Process webhook error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while processing webhook'
        });
    }
};

// Get all payments (admin only)
exports.getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, payment_method, start_date, end_date } = req.query;
        const skip = (page - 1) * limit;

        const query = {};

        if (status) query.payment_status = status;
        if (payment_method) query.payment_method = payment_method;
        
        if (start_date && end_date) {
            query.created_at = {
                $gte: new Date(start_date),
                $lte: new Date(end_date)
            };
        }

        const payments = await Payment.find(query)
            .populate('user_id', 'name email sid')
            .populate('subscription_id')
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Payment.countDocuments(query);

        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_records: total,
            per_page: parseInt(limit)
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Payments retrieved successfully',
            data: payments,
            pagination
        });

    } catch (error) {
        console.error('Get all payments error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving payments'
        });
    }
};

// Get payment statistics (admin only)
exports.getPaymentStats = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        const matchStage = {};
        if (start_date && end_date) {
            matchStage.created_at = {
                $gte: new Date(start_date),
                $lte: new Date(end_date)
            };
        }

        const stats = await Payment.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    completedPayments: {
                        $sum: { $cond: [{ $eq: ['$payment_status', 'completed'] }, 1, 0] }
                    },
                    completedAmount: {
                        $sum: { $cond: [{ $eq: ['$payment_status', 'completed'] }, '$amount', 0] }
                    },
                    pendingPayments: {
                        $sum: { $cond: [{ $eq: ['$payment_status', 'pending'] }, 1, 0] }
                    },
                    failedPayments: {
                        $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] }
                    }
                }
            }
        ]);

        const paymentStats = stats[0] || {
            totalPayments: 0,
            totalAmount: 0,
            completedPayments: 0,
            completedAmount: 0,
            pendingPayments: 0,
            failedPayments: 0
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Payment statistics retrieved successfully',
            data: paymentStats
        });

    } catch (error) {
        console.error('Get payment stats error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving payment statistics'
        });
    }
};

// Helper function to create or update subscription
async function createOrUpdateSubscription(payment) {
    try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + payment.subscription_duration);

        // Deactivate existing subscriptions
        await Subscription.updateMany(
            { user_id: payment.user_id, status: 'active' },
            { status: 'inactive' }
        );

        // Create new subscription
        const subscription = new Subscription({
            user_id: payment.user_id,
            subscription_type: payment.subscription_type,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            payment_id: payment._id
        });

        await subscription.save();

        // Update payment with subscription reference
        payment.subscription_id = subscription._id;
        await payment.save();

        return subscription;
    } catch (error) {
        console.error('Create subscription error:', error);
        throw error;
    }
}

// Helper function to generate payment URL
function generatePaymentUrl(payment, paymentMethod) {
    // Implement based on your payment gateway
    // This is a placeholder implementation
    const baseUrl = process.env.PAYMENT_GATEWAY_URL || 'https://payment.example.com';
    return `${baseUrl}/pay/${payment.transaction_id}?method=${paymentMethod}`;
} 