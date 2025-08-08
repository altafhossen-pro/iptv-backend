// controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const User = require('../models/User');
const sendResponse = require('../utils/sendResponse');
const ManualPayment = require('../models/ManualPayment');

// Get current user's subscription
exports.getUserSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.getActiveByUser(req.user.userId);

        if (!subscription) {
            // Check if user has a free subscription or create one
            const freeSubscription = await Subscription.findOneAndUpdate(
                { user_id: req.user.userId, subscription_type: 'free' },
                {
                    user_id: req.user.userId,
                    subscription_type: 'free',
                    status: 'active'
                },
                { upsert: true, new: true }
            ).populate('user_id', 'name email');

            return sendResponse({
                res,
                statusCode: 200,
                success: true,
                message: 'Free subscription retrieved successfully',
                data: {
                    subscription: freeSubscription,
                    isActive: true,
                    daysRemaining: null,
                    hasPremiumAccess: false
                }
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription retrieved successfully',
            data: {
                subscription,
                isActive: subscription.isActive,
                daysRemaining: subscription.daysRemaining,
                hasPremiumAccess: subscription.hasPremiumAccess()
            }
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving subscription'
        });
    }
};

// Get subscription plans
exports.getSubscriptionPlans = async (req, res) => {
    try {
        const plans = [
            {
                id: 'free',
                name: 'Free Plan',
                description: 'Limited channels with ads',
                price: 0,
                currency: 'BDT',
                duration: null,
                subscription_type: 'free',
                features: [
                    'Limited free channels',
                    'Standard quality',
                    'Advertisements included',
                    'Basic support'
                ],
                limitations: [
                    'No premium channels',
                    'Advertisement breaks',
                    'Limited concurrent streams'
                ]
            },
            {
                id: 'basic_monthly',
                name: 'Basic Monthly',
                description: 'More channels, fewer ads',
                price: 199,
                currency: 'BDT',
                duration: 30,
                subscription_type: 'basic',
                features: [
                    'Access to basic channels',
                    'HD quality streaming',
                    'Reduced advertisements',
                    'Email support',
                    '2 concurrent streams'
                ]
            },
            {
                id: 'basic_quarterly',
                name: 'Basic Quarterly',
                description: '3 months basic subscription',
                price: 499,
                currency: 'BDT',
                duration: 90,
                subscription_type: 'basic',
                discount: '16% savings',
                originalPrice: 597,
                features: [
                    'All basic monthly features',
                    '3 months subscription',
                    'Priority support'
                ]
            },
            {
                id: 'premium_monthly',
                name: 'Premium Monthly',
                description: 'All channels, no ads, HD quality',
                price: 399,
                currency: 'BDT',
                duration: 30,
                subscription_type: 'premium',
                popular: true,
                features: [
                    'Access to all premium channels',
                    'Full HD quality streaming',
                    'No advertisements',
                    'Priority customer support',
                    '4 concurrent streams',
                    'Download for offline viewing'
                ]
            },
            {
                id: 'premium_quarterly',
                name: 'Premium Quarterly',
                description: '3 months premium subscription',
                price: 999,
                currency: 'BDT',
                duration: 90,
                subscription_type: 'premium',
                discount: '17% savings',
                originalPrice: 1197,
                features: [
                    'All premium monthly features',
                    '3 months subscription',
                    'Priority support',
                    'Early access to new channels'
                ]
            },
            {
                id: 'premium_yearly',
                name: 'Premium Yearly',
                description: '12 months premium subscription',
                price: 3499,
                currency: 'BDT',
                duration: 365,
                subscription_type: 'premium',
                discount: '27% savings',
                originalPrice: 4788,
                bestValue: true,
                features: [
                    'All premium features',
                    '12 months subscription',
                    '24/7 priority support',
                    'Exclusive content access',
                    'Family sharing (up to 6 devices)'
                ]
            },
            {
                id: 'vip_monthly',
                name: 'VIP Monthly',
                description: 'Everything + exclusive content',
                price: 599,
                currency: 'BDT',
                duration: 30,
                subscription_type: 'vip',
                features: [
                    'All premium features',
                    'Exclusive VIP channels',
                    '4K quality streaming',
                    'Dedicated customer support',
                    'Unlimited concurrent streams',
                    'Early access to new features'
                ]
            },
            {
                id: 'vip_yearly',
                name: 'VIP Yearly',
                description: '12 months VIP subscription',
                price: 5999,
                currency: 'BDT',
                duration: 365,
                subscription_type: 'vip',
                discount: '17% savings',
                originalPrice: 7188,
                features: [
                    'All VIP features',
                    '12 months subscription',
                    'Premium customer support',
                    'Exclusive live events access',
                    'Custom channel requests'
                ]
            }
        ];

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription plans retrieved successfully',
            data: { plans }
        });
    } catch (error) {
        console.error('Get plans error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving plans'
        });
    }
};

// Subscribe to a plan
exports.subscribeToPlan = async (req, res) => {
    try {
        const { planId, paymentMethod = 'bkash', couponCode } = req.body;
        const userId = req.user.userId;

        // Validate plan
        const plansData = [
            { id: 'basic_monthly', price: 199, duration: 30, subscription_type: 'basic' },
            { id: 'basic_quarterly', price: 499, duration: 90, subscription_type: 'basic' },
            { id: 'premium_monthly', price: 399, duration: 30, subscription_type: 'premium' },
            { id: 'premium_quarterly', price: 999, duration: 90, subscription_type: 'premium' },
            { id: 'premium_yearly', price: 3499, duration: 365, subscription_type: 'premium' },
            { id: 'vip_monthly', price: 599, duration: 30, subscription_type: 'vip' },
            { id: 'vip_yearly', price: 5999, duration: 365, subscription_type: 'vip' }
        ];

        const selectedPlan = plansData.find(plan => plan.id === planId);
        if (!selectedPlan) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid subscription plan'
            });
        }

        // Check if user already has an active premium subscription
        const existingSubscription = await Subscription.getActiveByUser(userId);
        if (existingSubscription && existingSubscription.subscription_type !== 'free') {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'You already have an active subscription. Please cancel or wait for it to expire.'
            });
        }

        // Calculate pricing (apply coupon if provided)
        let finalAmount = selectedPlan.price;
        let discountAmount = 0;

        if (couponCode) {
            // Simple coupon validation (you might want to create a Coupon model)
            const validCoupons = {
                'WELCOME10': { discount: 10, type: 'percentage' },
                'SAVE50': { discount: 50, type: 'fixed' },
                'NEWUSER15': { discount: 15, type: 'percentage' }
            };

            const coupon = validCoupons[couponCode.toUpperCase()];
            if (coupon) {
                if (coupon.type === 'percentage') {
                    discountAmount = Math.round((finalAmount * coupon.discount) / 100);
                } else {
                    discountAmount = coupon.discount;
                }
                finalAmount = finalAmount - discountAmount;
            }
        }

        // Create payment record
        const payment = new Payment({
            user_id: userId,
            amount: selectedPlan.price,
            discount_amount: discountAmount,
            currency: 'BDT',
            payment_method: paymentMethod,
            subscription_duration: selectedPlan.duration,
            subscription_type: selectedPlan.subscription_type,
            coupon_code: couponCode || null
        });

        await payment.save();

        // Create subscription
        const subscription = new Subscription({
            user_id: userId,
            subscription_type: selectedPlan.subscription_type,
            start_date: new Date(),
            end_date: new Date(Date.now() + (selectedPlan.duration * 24 * 60 * 60 * 1000)),
            status: 'active',
            auto_renewal: false
        });

        await subscription.save();

        // Update payment with subscription reference
        payment.subscription_id = subscription._id;
        await payment.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Subscription created successfully',
            data: {
                subscription,
                payment,
                plan: selectedPlan
            }
        });

    } catch (error) {
        console.error('Subscribe to plan error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating subscription'
        });
    }
};

// Create/Purchase subscription
exports.createSubscription = async (req, res) => {
    try {
        const { planId, paymentMethod = 'bkash', couponCode } = req.body;
        const userId = req.user.userId;

        // Validate plan
        const plans = await exports.getSubscriptionPlans({ body: {} }, {
            json: () => { },
            status: () => ({ json: () => { } })
        });

        // Get plans data (in real scenario, you might store this in database)
        const plansData = [
            { id: 'basic_monthly', price: 199, duration: 30, subscription_type: 'basic' },
            { id: 'basic_quarterly', price: 499, duration: 90, subscription_type: 'basic' },
            { id: 'premium_monthly', price: 399, duration: 30, subscription_type: 'premium' },
            { id: 'premium_quarterly', price: 999, duration: 90, subscription_type: 'premium' },
            { id: 'premium_yearly', price: 3499, duration: 365, subscription_type: 'premium' },
            { id: 'vip_monthly', price: 599, duration: 30, subscription_type: 'vip' },
            { id: 'vip_yearly', price: 5999, duration: 365, subscription_type: 'vip' }
        ];

        const selectedPlan = plansData.find(plan => plan.id === planId);
        if (!selectedPlan) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid subscription plan'
            });
        }

        // Check if user already has an active premium subscription
        const existingSubscription = await Subscription.getActiveByUser(userId);
        if (existingSubscription && existingSubscription.subscription_type !== 'free') {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'You already have an active subscription. Please cancel or wait for it to expire.'
            });
        }

        // Calculate pricing (apply coupon if provided)
        let finalAmount = selectedPlan.price;
        let discountAmount = 0;

        if (couponCode) {
            // Simple coupon validation (you might want to create a Coupon model)
            const validCoupons = {
                'WELCOME10': { discount: 10, type: 'percentage' },
                'SAVE50': { discount: 50, type: 'fixed' },
                'NEWUSER15': { discount: 15, type: 'percentage' }
            };

            const coupon = validCoupons[couponCode.toUpperCase()];
            if (coupon) {
                if (coupon.type === 'percentage') {
                    discountAmount = Math.round((finalAmount * coupon.discount) / 100);
                } else {
                    discountAmount = coupon.discount;
                }
                finalAmount = finalAmount - discountAmount;
            }
        }

        // Create payment record
        const payment = new Payment({
            user_id: userId,
            amount: selectedPlan.price,
            discount_amount: discountAmount,
            currency: 'BDT',
            payment_method: paymentMethod,
            subscription_duration: selectedPlan.duration,
            subscription_type: selectedPlan.subscription_type,
            coupon_code: couponCode?.toUpperCase() || null,
            payment_status: 'pending'
        });

        await payment.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Subscription order created successfully',
            data: {
                payment: {
                    transaction_id: payment.transaction_id,
                    amount: payment.amount,
                    discount_amount: payment.discount_amount,
                    net_amount: payment.netAmount,
                    payment_method: payment.payment_method,
                    subscription_type: payment.subscription_type,
                    duration: payment.subscription_duration
                }
            }
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating subscription'
        });
    }
};

// Activate subscription after successful payment
exports.activateSubscription = async (req, res) => {
    try {
        const { transactionId, bkashTransactionId, gatewayResponse } = req.body;
        const userId = req.user.userId;

        // Find pending payment
        const payment = await Payment.findOne({
            transaction_id: transactionId,
            user_id: userId,
            payment_status: 'pending'
        });

        if (!payment) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Payment record not found or already processed'
            });
        }

        // Mark payment as completed
        payment.bkash_transaction_id = bkashTransactionId;
        await payment.markCompleted(gatewayResponse);

        // Create or update subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + payment.subscription_duration);

        // Cancel existing active subscription (if any)
        const existingSubscription = await Subscription.getActiveByUser(userId);
        if (existingSubscription && existingSubscription.subscription_type !== 'free') {
            await existingSubscription.cancel();
        }

        // Create new subscription
        const subscription = new Subscription({
            user_id: userId,
            subscription_type: payment.subscription_type,
            start_date: startDate,
            end_date: endDate,
            status: 'active'
        });

        await subscription.save();

        // Update payment with subscription reference
        payment.subscription_id = subscription._id;
        await payment.save();

        // Populate subscription data
        await subscription.populate('user_id', 'name email');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription activated successfully',
            data: {
                subscription: {
                    ...subscription.toJSON(),
                    isActive: subscription.isActive,
                    daysRemaining: subscription.daysRemaining,
                    hasPremiumAccess: subscription.hasPremiumAccess()
                },
                payment: {
                    transaction_id: payment.transaction_id,
                    bkash_transaction_id: payment.bkash_transaction_id,
                    amount: payment.amount,
                    net_amount: payment.netAmount
                }
            }
        });
    } catch (error) {
        console.error('Activate subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while activating subscription'
        });
    }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { reason } = req.body;

        const subscription = await Subscription.getActiveByUser(userId);
        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'No active subscription found'
            });
        }

        if (subscription.subscription_type === 'free') {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Cannot cancel free subscription'
            });
        }

        // Cancel the subscription
        await subscription.cancel();

        // Log the cancellation reason (you might want to create a separate model for this)
        console.log(`Subscription cancelled for user ${userId}: ${reason}`);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription cancelled successfully',
            data: {
                subscription: {
                    ...subscription.toJSON(),
                    isActive: subscription.isActive,
                    hasPremiumAccess: subscription.hasPremiumAccess()
                }
            }
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while cancelling subscription'
        });
    }
};

// Get subscription history
exports.getSubscriptionHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get payment history (which represents subscription purchases)
        const payments = await Payment.getPaymentHistory(userId, parseInt(limit), skip);
        const totalPayments = await Payment.countDocuments({ user_id: userId });

        // Get all subscriptions for the user
        const subscriptions = await Subscription.find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription history retrieved successfully',
            data: {
                payments,
                subscriptions,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalPayments / limit),
                    totalItems: totalPayments,
                    hasNext: page * limit < totalPayments,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get subscription history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving subscription history'
        });
    }
};

// Check subscription status and channel access
exports.checkChannelAccess = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { channelId, channelType } = req.params;

        const subscription = await Subscription.getActiveByUser(userId);

        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 403,
                success: false,
                message: 'No active subscription found'
            });
        }

        // Check access based on channel type and subscription
        let hasAccess = false;
        let message = '';

        if (channelType === 'free') {
            hasAccess = true;
            message = 'Access granted to free channel';
        } else if (channelType === 'premium') {
            hasAccess = subscription.hasPremiumAccess();
            message = hasAccess
                ? 'Access granted to premium channel'
                : 'Premium subscription required for this channel';
        } else if (channelType === 'vip') {
            hasAccess = subscription.subscription_type === 'vip' && subscription.isActive;
            message = hasAccess
                ? 'Access granted to VIP channel'
                : 'VIP subscription required for this channel';
        }

        return sendResponse({
            res,
            statusCode: hasAccess ? 200 : 403,
            success: hasAccess,
            message,
            data: {
                hasAccess,
                subscription: {
                    type: subscription.subscription_type,
                    isActive: subscription.isActive,
                    daysRemaining: subscription.daysRemaining
                }
            }
        });
    } catch (error) {
        console.error('Check channel access error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while checking channel access'
        });
    }
};

// Renew subscription
exports.renewSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { duration = 30 } = req.body; // days to extend

        const subscription = await Subscription.getActiveByUser(userId);
        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'No active subscription found'
            });
        }

        if (subscription.subscription_type === 'free') {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Cannot renew free subscription'
            });
        }

        // Extend the subscription
        await subscription.extend(duration);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Subscription extended by ${duration} days`,
            data: {
                subscription: {
                    ...subscription.toJSON(),
                    isActive: subscription.isActive,
                    daysRemaining: subscription.daysRemaining,
                    hasPremiumAccess: subscription.hasPremiumAccess()
                }
            }
        });
    } catch (error) {
        console.error('Renew subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while renewing subscription'
        });
    }
};

// Admin: Get all subscriptions
exports.getAllSubscriptions = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, subscription_type } = req.query;
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = {};
        if (status) filter.status = status;
        if (subscription_type) filter.subscription_type = subscription_type;

        const subscriptions = await Subscription.find(filter)
            .populate('user_id', 'name email')
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const totalSubscriptions = await Subscription.countDocuments(filter);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscriptions retrieved successfully',
            data: {
                subscriptions,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalSubscriptions / limit),
                    totalItems: totalSubscriptions,
                    hasNext: page * limit < totalSubscriptions,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get all subscriptions error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving subscriptions'
        });
    }
};

// Admin: Get subscription analytics
exports.getSubscriptionAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        // Get subscription statistics
        const stats = await Subscription.aggregate([
            {
                $group: {
                    _id: '$subscription_type',
                    count: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get revenue statistics
        const revenueStats = await Payment.getRevenueStats(start, end);

        // Get expiring subscriptions
        const expiringSubscriptions = await Subscription.getExpiring(7);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Analytics retrieved successfully',
            data: {
                subscriptionStats: stats,
                revenueStats,
                expiringSubscriptions: expiringSubscriptions.length,
                dateRange: { startDate: start, endDate: end }
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving analytics'
        });
    }
};

// Admin: Get subscription statistics overview
exports.getSubscriptionStats = async (req, res) => {
    try {
        // Get total subscriptions
        const totalSubscriptions = await Subscription.countDocuments();

        // Get active subscriptions
        const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });

        // Get subscriptions by type
        const subscriptionsByType = await Subscription.aggregate([
            {
                $group: {
                    _id: '$subscription_type',
                    count: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get recent subscriptions (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentSubscriptions = await Subscription.countDocuments({
            created_at: { $gte: thirtyDaysAgo }
        });

        // Get expiring subscriptions (next 7 days)
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const expiringSubscriptions = await Subscription.countDocuments({
            end_date: { $lte: sevenDaysFromNow, $gte: new Date() },
            status: 'active'
        });

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription statistics retrieved successfully',
            data: {
                totalSubscriptions,
                activeSubscriptions,
                inactiveSubscriptions: totalSubscriptions - activeSubscriptions,
                subscriptionsByType,
                recentSubscriptions,
                expiringSubscriptions,
                activeRate: totalSubscriptions > 0 ? ((activeSubscriptions / totalSubscriptions) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Get subscription stats error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving subscription statistics'
        });
    }
};

// Admin: Get subscription by ID
exports.getSubscriptionById = async (req, res) => {
    try {
        const { subscriptionId } = req.params;

        const subscription = await Subscription.findById(subscriptionId)
            .populate('user_id', 'name email');

        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Subscription not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription retrieved successfully',
            data: subscription
        });
    } catch (error) {
        console.error('Get subscription by ID error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving subscription'
        });
    }
};

// Admin: Update subscription
exports.updateSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { subscription_type, status, auto_renewal, end_date } = req.body;

        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Subscription not found'
            });
        }

        // Update fields
        if (subscription_type) subscription.subscription_type = subscription_type;
        if (status) subscription.status = status;
        if (auto_renewal !== undefined) subscription.auto_renewal = auto_renewal;
        if (end_date) subscription.end_date = new Date(end_date);

        await subscription.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription updated successfully',
            data: subscription
        });
    } catch (error) {
        console.error('Update subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating subscription'
        });
    }
};

// Admin: Delete subscription
exports.deleteSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;

        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Subscription not found'
            });
        }

        await Subscription.findByIdAndDelete(subscriptionId);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription deleted successfully'
        });
    } catch (error) {
        console.error('Delete subscription error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while deleting subscription'
        });
    }
};

// Admin: Update subscription status
exports.updateSubscriptionStatus = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { status } = req.body;

        if (!['active', 'expired', 'cancelled', 'suspended'].includes(status)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid status value'
            });
        }

        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Subscription not found'
            });
        }

        subscription.status = status;
        await subscription.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Subscription status updated successfully',
            data: subscription
        });
    } catch (error) {
        console.error('Update subscription status error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating subscription status'
        });
    }
};

exports.manualPayment = async (req, res) => {
    try {
        const data = req.body;
        const userId = req.user.userId;
        const newData = {
            ...data,
            user_id: userId,
            payment_method: 'manual',
            payment_status: 'pending',
        };
        const newManualPayment = await ManualPayment.create(newData);
        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Manual payment created successfully',
            data: newManualPayment
        });

    } catch (error) {
        console.error('Manual payment error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating manual payment'
        });
    }
}

module.exports = exports;