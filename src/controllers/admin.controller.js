const User = require("../models/User");
const Channel = require("../models/Channel");
const Category = require("../models/Category");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const WatchHistory = require("../models/WatchHistory");
const ManualPayment = require("../models/ManualPayment");

const sendResponse = require("../utils/sendResponse");

exports.getLoadDataForDashboard = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalChannels = await Channel.countDocuments();
        const totalCategories = await Category.countDocuments();
        const totalSubscriptions = await Subscription.countDocuments({ status: 'active' });
        const totalPayments = await Payment.countDocuments();

        const totalWatchHistory = await WatchHistory.countDocuments();
        const totalActiveSubscriptions = await Subscription.countDocuments({ status: 'active' });
        const totalExpiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
        const totalCancelledSubscriptions = await Subscription.countDocuments({ status: 'cancelled' });
        const totalRevenueResult = await Payment.aggregate([
            { $match: { payment_status: 'completed' } },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
        ]);
        const totalRevenue = totalRevenueResult[0]?.totalAmount || 0;

        const totalManualPayments = await ManualPayment.countDocuments();
        const totalPendingPayments = await Payment.countDocuments({ status: 'pending' });
        const totalCompletedPayments = await Payment.countDocuments({ status: 'completed' });
        const totalFailedPayments = await Payment.countDocuments({ status: 'failed' });
        const totalFreeSubscriptions = await Subscription.countDocuments({ subscription_type: 'free' });
        const totalPremiumSubscriptions = await Subscription.countDocuments({ subscription_type: 'premium', status: 'active' });
        const totalActiveUsers = await User.countDocuments({ status: 'active' });
        const totalInactiveUsers = await User.countDocuments({ status: 'inactive' });
        const totalChannelsByCategory = await Channel.aggregate([
            { $group: { _id: '$category_id', count: { $sum: 1 } } }
        ]);
        const totalChannelsByStatus = await Channel.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const totalSubscriptionsByType = await Subscription.aggregate([
            { $group: { _id: '$subscription_type', count: { $sum: 1 } } }
        ]);
        const totalPaymentsByStatus = await Payment.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const totalWatchHistoryByUser = await WatchHistory.aggregate([
            { $group: { _id: '$user_id', count: { $sum: 1 } } }
        ]);
        const totalManualPaymentsByStatus = await ManualPayment.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const totalUsersBySubscriptionType = await User.aggregate([
            { $lookup: { from: 'subscriptions', localField: '_id', foreignField: 'user_id', as: 'subscription' } },
            { $unwind: '$subscription' },
            { $group: { _id: '$subscription.subscription_type', count: { $sum: 1 } } }
        ]);
        const totalUsersByStatus = await User.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Dashboard data loaded successfully',
            data: {
                totalUsers,
                totalRevenue,
                totalChannels,
                totalCategories,
                totalSubscriptions,
                totalPayments,
                totalWatchHistory,
                totalActiveSubscriptions,
                totalExpiredSubscriptions,
                totalCancelledSubscriptions,
                totalManualPayments,
                totalPendingPayments,
                totalCompletedPayments,
                totalFailedPayments,
                totalFreeSubscriptions,
                totalPremiumSubscriptions,
                totalActiveUsers,
                totalInactiveUsers,
            }
        })
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data',
            error: error.message
        });
    }
}