// controllers/watchHistoryController.js
const WatchHistory = require('../models/WatchHistory');
const Channel = require('../models/Channel');
const User = require('../models/User');
const sendResponse = require('../utils/sendResponse');

// Get user's watch history
exports.getUserWatchHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, channel_id } = req.query;
        const skip = (page - 1) * limit;

        const query = { user_id: req.user.userId };
        if (channel_id) {
            query.channel_id = channel_id;
        }

        const watchHistory = await WatchHistory.find(query)
            .populate('channel_id', 'name logo thumbnail category_id is_premium')
            .populate({
                path: 'channel_id',
                populate: {
                    path: 'category_id',
                    select: 'name slug'
                }
            })
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await WatchHistory.countDocuments(query);

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

// Add watch history entry
exports.addWatchHistory = async (req, res) => {
    try {
        const { channel_id, watch_duration, device_type, session_id } = req.body;

        if (!channel_id) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Channel ID is required'
            });
        }

        // Check if channel exists
        const channel = await Channel.findById(channel_id);
        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        // Check if user has access to premium channel
        if (channel.is_premium) {
            const Subscription = require('../models/Subscription');
            const subscription = await Subscription.getActiveByUser(req.user.userId);
            if (!subscription || !subscription.hasPremiumAccess()) {
                return sendResponse({
                    res,
                    statusCode: 403,
                    success: false,
                    message: 'Premium subscription required to access this channel'
                });
            }
        }

        const watchHistory = new WatchHistory({
            user_id: req.user.userId,
            channel_id,
            watch_duration: watch_duration || 0,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            device_type: device_type || 'unknown',
            session_id: session_id || null
        });

        await watchHistory.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Watch history added successfully',
            data: watchHistory
        });

    } catch (error) {
        console.error('Add watch history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while adding watch history'
        });
    }
};

// Update watch duration
exports.updateWatchDuration = async (req, res) => {
    try {
        const { historyId } = req.params;
        const { additional_duration } = req.body;

        if (!additional_duration || additional_duration < 0) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Valid additional duration is required'
            });
        }

        const watchHistory = await WatchHistory.findById(historyId);
        if (!watchHistory) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Watch history not found'
            });
        }

        // Verify ownership
        if (watchHistory.user_id.toString() !== req.user.userId) {
            return sendResponse({
                res,
                statusCode: 403,
                success: false,
                message: 'Access denied'
            });
        }

        await watchHistory.updateDuration(additional_duration);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Watch duration updated successfully',
            data: watchHistory
        });

    } catch (error) {
        console.error('Update watch duration error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating watch duration'
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

// Remove specific watch history entry
exports.removeWatchHistoryEntry = async (req, res) => {
    try {
        const { historyId } = req.params;

        const watchHistory = await WatchHistory.findById(historyId);
        if (!watchHistory) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Watch history not found'
            });
        }

        // Verify ownership
        if (watchHistory.user_id.toString() !== req.user.userId) {
            return sendResponse({
                res,
                statusCode: 403,
                success: false,
                message: 'Access denied'
            });
        }

        await WatchHistory.findByIdAndDelete(historyId);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Watch history entry removed successfully'
        });

    } catch (error) {
        console.error('Remove watch history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while removing watch history entry'
        });
    }
};

// Get user's watch statistics
exports.getUserWatchStats = async (req, res) => {
    try {
        const stats = await WatchHistory.aggregate([
            { $match: { user_id: req.user.userId } },
            {
                $group: {
                    _id: null,
                    totalWatchTime: { $sum: '$watch_duration' },
                    totalSessions: { $sum: 1 },
                    uniqueChannels: { $addToSet: '$channel_id' },
                    averageSessionTime: { $avg: '$watch_duration' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalWatchTime: 1,
                    totalSessions: 1,
                    uniqueChannels: { $size: '$uniqueChannels' },
                    averageSessionTime: 1
                }
            }
        ]);

        const userStats = stats[0] || {
            totalWatchTime: 0,
            totalSessions: 0,
            uniqueChannels: 0,
            averageSessionTime: 0
        };

        // Get most watched channels
        const mostWatchedChannels = await WatchHistory.aggregate([
            { $match: { user_id: req.user.userId } },
            {
                $group: {
                    _id: '$channel_id',
                    totalWatchTime: { $sum: '$watch_duration' },
                    sessionCount: { $sum: 1 }
                }
            },
            { $sort: { totalWatchTime: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'channels',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'channel'
                }
            },
            { $unwind: '$channel' },
            {
                $project: {
                    channel: {
                        _id: '$channel._id',
                        name: '$channel.name',
                        logo: '$channel.logo',
                        thumbnail: '$channel.thumbnail'
                    },
                    totalWatchTime: 1,
                    sessionCount: 1
                }
            }
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Watch statistics retrieved successfully',
            data: {
                stats: {
                    ...userStats,
                    formattedTotalWatchTime: formatDuration(userStats.totalWatchTime),
                    formattedAverageSessionTime: formatDuration(userStats.averageSessionTime)
                },
                mostWatchedChannels
            }
        });

    } catch (error) {
        console.error('Get watch stats error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving watch statistics'
        });
    }
};

// Get all watch history (admin only)
exports.getAllWatchHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, user_id, channel_id, start_date, end_date } = req.query;
        const skip = (page - 1) * limit;

        const query = {};

        if (user_id) query.user_id = user_id;
        if (channel_id) query.channel_id = channel_id;
        
        if (start_date && end_date) {
            query.created_at = {
                $gte: new Date(start_date),
                $lte: new Date(end_date)
            };
        }

        const watchHistory = await WatchHistory.find(query)
            .populate('user_id', 'name email sid')
            .populate('channel_id', 'name logo thumbnail')
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await WatchHistory.countDocuments(query);

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
        console.error('Get all watch history error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving watch history'
        });
    }
};

// Get channel analytics (admin only)
exports.getChannelAnalytics = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { start_date, end_date } = req.query;

        const matchStage = { channel_id: channelId };
        if (start_date && end_date) {
            matchStage.created_at = {
                $gte: new Date(start_date),
                $lte: new Date(end_date)
            };
        }

        const analytics = await WatchHistory.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalWatchTime: { $sum: '$watch_duration' },
                    totalSessions: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$user_id' },
                    averageSessionTime: { $avg: '$watch_duration' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalWatchTime: 1,
                    totalSessions: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    averageSessionTime: 1
                }
            }
        ]);

        const channelAnalytics = analytics[0] || {
            totalWatchTime: 0,
            totalSessions: 0,
            uniqueUsers: 0,
            averageSessionTime: 0
        };

        // Get top viewers for this channel
        const topViewers = await WatchHistory.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$user_id',
                    totalWatchTime: { $sum: '$watch_duration' },
                    sessionCount: { $sum: 1 }
                }
            },
            { $sort: { totalWatchTime: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    user: {
                        _id: '$user._id',
                        name: '$user.name',
                        email: '$user.email',
                        sid: '$user.sid'
                    },
                    totalWatchTime: 1,
                    sessionCount: 1
                }
            }
        ]);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Channel analytics retrieved successfully',
            data: {
                analytics: {
                    ...channelAnalytics,
                    formattedTotalWatchTime: formatDuration(channelAnalytics.totalWatchTime),
                    formattedAverageSessionTime: formatDuration(channelAnalytics.averageSessionTime)
                },
                topViewers
            }
        });

    } catch (error) {
        console.error('Get channel analytics error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving channel analytics'
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