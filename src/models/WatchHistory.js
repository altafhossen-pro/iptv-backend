// models/WatchHistory.js
const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    channel_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Channel',
        required: [true, 'Channel ID is required']
    },
    watch_duration: {
        type: Number, // in seconds
        default: 0,
        min: [0, 'Watch duration cannot be negative']
    },
    ip_address: {
        type: String,
        required: true
    },
    user_agent: {
        type: String,
        required: true
    },
    device_type: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'smart_tv', 'unknown'],
        default: 'unknown'
    },
    session_id: {
        type: String,
        default: null
    },
    country: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for efficient queries
watchHistorySchema.index({ user_id: 1, created_at: -1 });
watchHistorySchema.index({ channel_id: 1, created_at: -1 });
watchHistorySchema.index({ created_at: -1 });
watchHistorySchema.index({ user_id: 1, channel_id: 1 });
watchHistorySchema.index({ session_id: 1 });
watchHistorySchema.index({ ip_address: 1 });

// Virtual to format watch duration
watchHistorySchema.virtual('formattedDuration').get(function () {
    const duration = this.watch_duration;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
});

// Method to update watch duration
watchHistorySchema.methods.updateDuration = async function (additionalSeconds) {
    this.watch_duration += additionalSeconds;
    return await this.save();
};

// Static method to get user's watch history
watchHistorySchema.statics.getUserHistory = function (userId, limit = 20, skip = 0) {
    return this.find({ user_id: userId })
        .populate('channel_id', 'name logo category_id is_premium')
        .populate({
            path: 'channel_id',
            populate: {
                path: 'category_id',
                select: 'name slug'
            }
        })
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get channel analytics
watchHistorySchema.statics.getChannelAnalytics = function (channelId, startDate, endDate) {
    const match = { channel_id: mongoose.Types.ObjectId(channelId) };

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueViewers: { $addToSet: '$user_id' },
                avgWatchTime: { $avg: '$watch_duration' }
            }
        },
        {
            $project: {
                _id: 0,
                totalViews: 1,
                totalWatchTime: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                avgWatchTime: { $round: ['$avgWatchTime', 2] }
            }
        }
    ]);
};

// Static method to get popular channels
watchHistorySchema.statics.getPopularChannels = function (limit = 10, startDate = null, endDate = null) {
    const match = {};

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$channel_id',
                viewCount: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueViewers: { $addToSet: '$user_id' }
            }
        },
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
                channelName: '$channel.name',
                channelLogo: '$channel.logo',
                channelCategory: '$channel.category_id',
                isPremium: '$channel.is_premium',
                viewCount: 1,
                totalWatchTime: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                avgWatchTime: {
                    $round: [{ $divide: ['$totalWatchTime', '$viewCount'] }, 2]
                }
            }
        },
        { $sort: { viewCount: -1 } },
        { $limit: limit }
    ]);
};

// Static method to get user viewing statistics
watchHistorySchema.statics.getUserStats = function (userId, startDate = null, endDate = null) {
    const match = { user_id: mongoose.Types.ObjectId(userId) };

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueChannels: { $addToSet: '$channel_id' },
                avgSessionDuration: { $avg: '$watch_duration' }
            }
        },
        {
            $project: {
                _id: 0,
                totalSessions: 1,
                totalWatchTime: 1,
                uniqueChannels: { $size: '$uniqueChannels' },
                avgSessionDuration: { $round: ['$avgSessionDuration', 2] }
            }
        }
    ]);
};

// Static method to get daily viewing statistics
watchHistorySchema.statics.getDailyStats = function (days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                created_at: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$created_at' },
                    month: { $month: '$created_at' },
                    day: { $dayOfMonth: '$created_at' }
                },
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueViewers: { $addToSet: '$user_id' }
            }
        },
        {
            $project: {
                date: {
                    $dateFromParts: {
                        year: '$_id.year',
                        month: '$_id.month',
                        day: '$_id.day'
                    }
                },
                totalViews: 1,
                totalWatchTime: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                avgWatchTime: {
                    $round: [{ $divide: ['$totalWatchTime', '$totalViews'] }, 2]
                }
            }
        },
        { $sort: { date: 1 } }
    ]);
};

// Static method to get hourly viewing patterns
watchHistorySchema.statics.getHourlyStats = function (days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                created_at: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: { $hour: '$created_at' },
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueViewers: { $addToSet: '$user_id' }
            }
        },
        {
            $project: {
                hour: '$_id',
                totalViews: 1,
                totalWatchTime: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                avgWatchTime: {
                    $round: [{ $divide: ['$totalWatchTime', '$totalViews'] }, 2]
                }
            }
        },
        { $sort: { hour: 1 } }
    ]);
};

// Static method to get device statistics
watchHistorySchema.statics.getDeviceStats = function (startDate = null, endDate = null) {
    const match = {};

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$device_type',
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueUsers: { $addToSet: '$user_id' }
            }
        },
        {
            $project: {
                deviceType: '$_id',
                totalViews: 1,
                totalWatchTime: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
                avgWatchTime: {
                    $round: [{ $divide: ['$totalWatchTime', '$totalViews'] }, 2]
                }
            }
        },
        { $sort: { totalViews: -1 } }
    ]);
};

// Static method to get geographic statistics
watchHistorySchema.statics.getGeoStats = function (startDate = null, endDate = null) {
    const match = {};

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    country: '$country',
                    city: '$city'
                },
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueUsers: { $addToSet: '$user_id' }
            }
        },
        {
            $project: {
                country: '$_id.country',
                city: '$_id.city',
                totalViews: 1,
                totalWatchTime: 1,
                uniqueUsers: { $size: '$uniqueUsers' }
            }
        },
        { $sort: { totalViews: -1 } }
    ]);
};

// Static method to get top viewers (users with most watch time)
watchHistorySchema.statics.getTopViewers = function (limit = 10, startDate = null, endDate = null) {
    const match = {};

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$user_id',
                totalSessions: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueChannels: { $addToSet: '$channel_id' },
                avgSessionDuration: { $avg: '$watch_duration' }
            }
        },
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
                userName: '$user.name',
                userEmail: '$user.email',
                totalSessions: 1,
                totalWatchTime: 1,
                uniqueChannels: { $size: '$uniqueChannels' },
                avgSessionDuration: { $round: ['$avgSessionDuration', 2] }
            }
        },
        { $sort: { totalWatchTime: -1 } },
        { $limit: limit }
    ]);
};

// Static method to get category-wise viewing statistics
watchHistorySchema.statics.getCategoryStats = function (startDate = null, endDate = null) {
    const match = {};

    if (startDate && endDate) {
        match.created_at = {
            $gte: startDate,
            $lte: endDate
        };
    }

    return this.aggregate([
        { $match: match },
        {
            $lookup: {
                from: 'channels',
                localField: 'channel_id',
                foreignField: '_id',
                as: 'channel'
            }
        },
        { $unwind: '$channel' },
        {
            $lookup: {
                from: 'categories',
                localField: 'channel.category_id',
                foreignField: '_id',
                as: 'category'
            }
        },
        { $unwind: '$category' },
        {
            $group: {
                _id: '$category._id',
                categoryName: { $first: '$category.name' },
                totalViews: { $sum: 1 },
                totalWatchTime: { $sum: '$watch_duration' },
                uniqueViewers: { $addToSet: '$user_id' },
                uniqueChannels: { $addToSet: '$channel_id' }
            }
        },
        {
            $project: {
                categoryName: 1,
                totalViews: 1,
                totalWatchTime: 1,
                uniqueViewers: { $size: '$uniqueViewers' },
                uniqueChannels: { $size: '$uniqueChannels' },
                avgWatchTime: {
                    $round: [{ $divide: ['$totalWatchTime', '$totalViews'] }, 2]
                }
            }
        },
        { $sort: { totalViews: -1 } }
    ]);
};

// Method to detect device type from user agent
watchHistorySchema.statics.detectDeviceType = function (userAgent) {
    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        return 'tablet';
    } else if (ua.includes('smart-tv') || ua.includes('smarttv') || ua.includes('tizen') || ua.includes('webos')) {
        return 'smart_tv';
    } else if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')) {
        return 'desktop';
    } else {
        return 'unknown';
    }
};

// Static method to create or update watch session
watchHistorySchema.statics.recordWatchSession = async function (data) {
    const {
        user_id,
        channel_id,
        session_id,
        watch_duration = 0,
        ip_address,
        user_agent,
        country = null,
        city = null
    } = data;

    // Try to find existing session
    let watchRecord = await this.findOne({
        user_id,
        channel_id,
        session_id
    });

    if (watchRecord) {
        // Update existing session
        watchRecord.watch_duration += watch_duration;
        watchRecord.updated_at = new Date();
        return await watchRecord.save();
    } else {
        // Create new session
        const device_type = this.detectDeviceType(user_agent);

        watchRecord = new this({
            user_id,
            channel_id,
            session_id,
            watch_duration,
            ip_address,
            user_agent,
            device_type,
            country,
            city
        });

        return await watchRecord.save();
    }
};

// Static method to get retention analytics
watchHistorySchema.statics.getRetentionAnalytics = function (days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                created_at: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    user_id: '$user_id',
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$created_at'
                        }
                    }
                }
            }
        },
        {
            $group: {
                _id: '$_id.user_id',
                activeDays: { $sum: 1 },
                firstSeen: { $min: '$_id.date' },
                lastSeen: { $max: '$_id.date' }
            }
        },
        {
            $group: {
                _id: '$activeDays',
                userCount: { $sum: 1 }
            }
        },
        {
            $project: {
                activeDays: '$_id',
                userCount: 1,
                retentionRate: {
                    $multiply: [
                        { $divide: ['$userCount', days] },
                        100
                    ]
                }
            }
        },
        { $sort: { activeDays: -1 } }
    ]);
};

// Pre-save middleware to detect device type
watchHistorySchema.pre('save', function (next) {
    if (this.isNew && this.user_agent && this.device_type === 'unknown') {
        this.device_type = this.constructor.detectDeviceType(this.user_agent);
    }
    next();
});

// Pre-save middleware to generate session ID if not provided
watchHistorySchema.pre('save', function (next) {
    if (this.isNew && !this.session_id) {
        this.session_id = `${this.user_id}_${this.channel_id}_${Date.now()}`;
    }
    next();
});

module.exports = mongoose.model('WatchHistory', watchHistorySchema);