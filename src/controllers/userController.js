// controllers/userController.js
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WatchHistory = require('../models/WatchHistory');
const sendResponse = require('../utils/sendResponse');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};

        if (status) {
            query.status = status;
        }

        if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { sid: searchRegex }
            ];
        }

        const users = await User.find(query, '-password')
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const userIds = users.map(u => u._id);

        const subscriptions = await Subscription.find({
            user_id: { $in: userIds },
            status: 'active'
        }).lean();

        const usersWithSubs = users.map(u => {
            u.subscription = subscriptions.find(s => s.user_id.toString() === u._id.toString()) || null;
            return u;
        });
        const total = await User.countDocuments(query);

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
            message: 'Users retrieved successfully',
            data: usersWithSubs,
            pagination
        });

    } catch (error) {
        console.error('Get users error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving users'
        });
    }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId, '-password')
            .populate({
                path: 'subscription',
                match: { status: 'active' }
            });

        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        const subscription = await Subscription.getActiveByUser(user._id);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'User retrieved successfully',
            data: {
                user,
                subscription
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving user'
        });
    }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, phone, status, avatar } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        // Check if email is being changed and if it conflicts
        if (email && email.toLowerCase() !== user.email) {
            const existingUser = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: userId }
            });

            if (existingUser) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update fields
        if (name) user.name = name.trim();
        if (email) user.email = email.toLowerCase();
        if (phone !== undefined) user.phone = phone;
        if (status) user.status = status;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'User updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update user error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating user'
        });
    }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has active subscription
        const activeSubscription = await Subscription.findOne({
            user_id: userId,
            status: 'active'
        });

        if (activeSubscription) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Cannot delete user with active subscription'
            });
        }

        await User.findByIdAndDelete(userId);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while deleting user'
        });
    }
};

// Get user's watch history
exports.getUserWatchHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const watchHistory = await WatchHistory.getUserHistory(
            req.user.userId,
            parseInt(limit),
            parseInt(skip)
        );

        const total = await WatchHistory.countDocuments({ user_id: req.user.userId });

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
            message: 'Watch history retrieved successfully',
            data: watchHistory,
            pagination
        });

    } catch (error) {
        console.error('Get watch history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving watch history'
        });
    }
};

// Clear user's watch history
exports.clearWatchHistory = async (req, res) => {
    try {
        await WatchHistory.deleteMany({ user_id: req.user.userId });

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Watch history cleared successfully'
        });

    } catch (error) {
        console.error('Clear watch history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while clearing watch history'
        });
    }
};

// Get user statistics (admin only)
exports.getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        // Get user's subscription
        const subscription = await Subscription.getActiveByUser(userId);

        // Get watch history stats
        const watchHistoryStats = await WatchHistory.aggregate([
            { $match: { user_id: user._id } },
            {
                $group: {
                    _id: null,
                    totalWatchTime: { $sum: '$watch_duration' },
                    totalSessions: { $sum: 1 },
                    uniqueChannels: { $addToSet: '$channel_id' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalWatchTime: 1,
                    totalSessions: 1,
                    uniqueChannels: { $size: '$uniqueChannels' }
                }
            }
        ]);

        const stats = watchHistoryStats[0] || {
            totalWatchTime: 0,
            totalSessions: 0,
            uniqueChannels: 0
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'User statistics retrieved successfully',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    sid: user.sid,
                    status: user.status,
                    created_at: user.created_at,
                    last_login: user.last_login
                },
                subscription,
                stats: {
                    totalWatchTime: stats.totalWatchTime,
                    totalSessions: stats.totalSessions,
                    uniqueChannels: stats.uniqueChannels,
                    formattedWatchTime: formatDuration(stats.totalWatchTime)
                }
            }
        });

    } catch (error) {
        console.error('Get user stats error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving user statistics'
        });
    }
};

// Helper function to format duration
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}