// controllers/channelController.js
const Channel = require('../models/Channel');
const Category = require('../models/Category');
const Subscription = require('../models/Subscription');
const WatchHistory = require('../models/WatchHistory');
const sendResponse = require('../utils/sendResponse');
const crypto = require('crypto');

// Get all channels with category filter
exports.getAllChannels = async (req, res) => {
    try {
        const { category, page = 1, limit = 20, quality, language, premium_only } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = { status: 'active', is_online: true };

        if (category) {
            const categoryDoc = await Category.findOne({ slug: category });
            if (categoryDoc) {
                query.category_id = categoryDoc._id;
            }
        }

        if (quality) query.quality = quality;
        if (language) query.language = language;

        if (premium_only === 'true') {
            query.is_premium = true;
        } else if (premium_only === 'false') {
            query.is_premium = false;
        }

        // Get channels with streaming URLs
        const channels = await Channel.find(query)
            .populate('category_id', 'name slug')
            .sort({ sort_order: 1, name: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        // Decrypt URLs and add to response
        const channelsWithStreams = channels.map(channel => {
            const channelObj = channel.toObject();

            // Add decrypted streaming URL directly
            channelObj.streaming_url = Buffer.from(channel.encrypted_url, 'base64').toString();

            // Remove encrypted field from response
            delete channelObj.encrypted_url;

            return channelObj;
        });

        const total = await Channel.countDocuments(query);

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
            message: 'Channels retrieved successfully',
            data: channelsWithStreams,
            pagination
        });

    } catch (error) {
        console.error('Get channels error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving channels'
        });
    }
};

// Get channels by category
exports.getChannelsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // Check user's subscription for premium access
        const subscription = await Subscription.getActiveByUser(req.user.userId);
        const hasPremiumAccess = subscription && subscription.hasPremiumAccess();

        const channels = await Channel.getByCategory(categoryId, hasPremiumAccess);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Channels retrieved successfully',
            data: channels
        });

    } catch (error) {
        console.error('Get channels by category error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving channels'
        });
    }
};

// Get free channels only
exports.getFreeChannels = async (req, res) => {
    try {
        const channels = await Channel.getFreeChannels();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Free channels retrieved successfully',
            data: channels
        });

    } catch (error) {
        console.error('Get free channels error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving free channels'
        });
    }
};

// Get single channel details
exports.getChannelById = async (req, res) => {
    try {
        const { channelId } = req.params;

        const channel = await Channel.findOne({
            _id: channelId,
            status: 'active'
        }).populate('category_id', 'name slug');

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

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Channel retrieved successfully',
            data: channel
        });

    } catch (error) {
        console.error('Get channel error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving channel'
        });
    }
};

// Get secure streaming URL
exports.getStreamingUrl = async (req, res) => {
    try {
        const { channelId } = req.params;

        const channel = await Channel.findOne({
            _id: channelId,
            status: 'active',
            is_online: true
        });

        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found or offline'
            });
        }

        // Check if user has access to premium channel
        if (channel.is_premium) {
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

        // Generate secure streaming token
        const streamToken = channel.generateStreamToken(req.user.userId, 3600); // 1 hour expiry

        // Create proxy URL instead of direct M3U8 URL
        const proxyUrl = `${process.env.STREAMING_BASE_URL || 'http://localhost:5000'}/stream/${channelId}`;

        // Record watch history
        const watchHistory = new WatchHistory({
            user_id: req.user.userId,
            channel_id: channelId,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            session_id: req.sessionID
        });

        await watchHistory.save();

        // Increment viewer count
        await channel.incrementViewerCount();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Streaming URL generated successfully',
            data: {
                streaming_url: proxyUrl,
                channel: {
                    id: channel._id,
                    name: channel.name,
                    logo: channel.logo,
                    quality: channel.quality
                },
                expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
                token: streamToken
            }
        });

    } catch (error) {
        console.error('Get streaming URL error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while generating streaming URL'
        });
    }
};

// Verify stream token (for proxy server)
exports.verifyStreamToken = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { token, user_id } = req.query;

        if (!token || !user_id) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Token and user ID are required'
            });
        }

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        // Verify token
        const expectedToken = channel.generateStreamToken(user_id, 3600);
        if (token !== expectedToken) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Check subscription for premium channels
        if (channel.is_premium) {
            const subscription = await Subscription.getActiveByUser(user_id);
            if (!subscription || !subscription.hasPremiumAccess()) {
                return sendResponse({
                    res,
                    statusCode: 403,
                    success: false,
                    message: 'Premium subscription required'
                });
            }
        }

        // Return decrypted URL for proxy server
        const actualUrl = channel.decryptUrl();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Token verified successfully',
            data: {
                url: actualUrl,
                channel_id: channelId
            }
        });

    } catch (error) {
        console.error('Verify stream token error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while verifying token'
        });
    }
};

// Search channels
exports.searchChannels = async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        if (!q || q.trim().length < 2) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const searchRegex = new RegExp(q.trim(), 'i');

        const query = {
            status: 'active',
            is_online: true,
            $or: [
                { name: searchRegex },
                { description: searchRegex }
            ]
        };

        const channels = await Channel.find(query)
            .populate('category_id', 'name slug')
            .sort({ viewer_count: -1, name: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Channel.countDocuments(query);

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
            message: 'Search results retrieved successfully',
            data: channels,
            pagination,
            meta: { search_query: q }
        });

    } catch (error) {
        console.error('Search channels error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while searching channels'
        });
    }
};


exports.createChannel = async (req, res) => {
    try {
        const {
            name,
            description,
            category_id,
            m3u8_url,
            thumbnail,
            logo,
            is_premium,
            quality,
            language,
            country,
            sort_order
        } = req.body;

        // Validate required fields
        if (!name || name.trim().length === 0) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Channel name is required'
            });
        }

        if (!category_id) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Category is required'
            });
        }

        if (!m3u8_url) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'M3U8 URL is required'
            });
        }

        // Check if category exists
        const category = await Category.findById(category_id);
        if (!category) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid category selected'
            });
        }

        // Check if channel with same name already exists
        const existingChannel = await Channel.findOne({
            name: { $regex: new RegExp('^' + name.trim() + '$', 'i') }
        });

        if (existingChannel) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Channel with this name already exists'
            });
        }

        const channel = new Channel({
            name: name.trim(),
            description: description?.trim() || '',
            category_id,
            m3u8_url: m3u8_url.trim(),
            thumbnail,
            logo,
            is_premium: is_premium || false,
            quality: quality || 'HD',
            language: language || 'Bangla',
            country: country || 'Bangladesh',
            sort_order: sort_order || 0,
            status: 'active',
            is_online: true
        });

        await channel.save();

        // Populate category data for response
        await channel.populate('category_id', 'name slug');

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Channel created successfully',
            data: channel
        });

    } catch (error) {
        console.error('Create channel error:', error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: `Channel ${field} already exists`
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating channel'
        });
    }
};

// Update channel
exports.updateChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const {
            name,
            description,
            category_id,
            m3u8_url,
            thumbnail,
            logo,
            is_premium,
            quality,
            language,
            country,
            sort_order
        } = req.body;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        // Check if new name conflicts with existing channel
        if (name && name.trim() !== channel.name) {
            const existingChannel = await Channel.findOne({
                name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
                _id: { $ne: channelId }
            });

            if (existingChannel) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'Channel with this name already exists'
                });
            }
        }

        // Validate category if provided
        if (category_id && category_id !== channel.category_id.toString()) {
            const category = await Category.findById(category_id);
            if (!category) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'Invalid category selected'
                });
            }
        }

        // Update fields
        if (name) channel.name = name.trim();
        if (description !== undefined) channel.description = description.trim();
        if (category_id) channel.category_id = category_id;
        if (m3u8_url) channel.m3u8_url = m3u8_url.trim();
        if (thumbnail !== undefined) channel.thumbnail = thumbnail;
        if (logo !== undefined) channel.logo = logo;
        if (is_premium !== undefined) channel.is_premium = is_premium;
        if (quality) channel.quality = quality;
        if (language) channel.language = language;
        if (country) channel.country = country;
        if (sort_order !== undefined) channel.sort_order = sort_order;

        await channel.save();

        // Populate category data for response
        await channel.populate('category_id', 'name slug');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Channel updated successfully',
            data: channel
        });

    } catch (error) {
        console.error('Update channel error:', error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: `Channel ${field} already exists`
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating channel'
        });
    }
};

// Delete channel
exports.deleteChannel = async (req, res) => {
    try {
        const { channelId } = req.params;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        // Optional: Check if channel has active viewers or watch history
        // You might want to keep watch history for analytics

        await Channel.findByIdAndDelete(channelId);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Channel deleted successfully'
        });

    } catch (error) {
        console.error('Delete channel error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while deleting channel'
        });
    }
};

// Update channel status (active/inactive/maintenance)
exports.updateChannelStatus = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive', 'maintenance'].includes(status)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid status. Must be "active", "inactive", or "maintenance"'
            });
        }

        const channel = await Channel.findByIdAndUpdate(
            channelId,
            { status },
            { new: true }
        ).populate('category_id', 'name slug');

        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Channel status updated to ${status} successfully`,
            data: channel
        });

    } catch (error) {
        console.error('Update channel status error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating channel status'
        });
    }
};

// Update channel online status
exports.updateOnlineStatus = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { is_online } = req.body;

        if (typeof is_online !== 'boolean') {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'is_online must be a boolean value'
            });
        }

        const channel = await Channel.findByIdAndUpdate(
            channelId,
            { is_online },
            { new: true }
        ).populate('category_id', 'name slug');

        if (!channel) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Channel not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Channel ${is_online ? 'brought online' : 'taken offline'} successfully`,
            data: channel
        });

    } catch (error) {
        console.error('Update online status error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating online status'
        });
    }
};