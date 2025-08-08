// models/Channel.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const slugify = require('slugify');

const channelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Channel name is required'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required']
    },
    m3u8_url: {
        type: String,
        required: [true, 'M3U8 URL is required']
    },
    encrypted_url: {
        type: String,
        required: false
    },
    thumbnail: {
        type: String,
        default: null
    },
    logo: {
        type: String,
        default: null
    },
    is_premium: {
        type: Boolean,
        default: false
    },
    is_online: {
        type: Boolean,
        default: true
    },
    sort_order: {
        type: Number,
        default: 0
    },
    viewer_count: {
        type: Number,
        default: 0
    },
    quality: {
        type: String,
        enum: ['SD', 'HD', 'FHD', '4K'],
        default: 'HD'
    },
    language: {
        type: String,
        enum: ['Bangla', 'English', 'Hindi', 'Arabic', 'Other'],
        default: 'Bangla'
    },
    country: {
        type: String,
        default: 'Bangladesh'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Auto-generate slug from name
channelSchema.pre('save', function (next) {
    if (this.isModified('name') || this.isNew) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
        });
    }
    next();
});

// Encrypt M3U8 URL before saving
channelSchema.pre('save', function (next) {
    if ((this.isModified('m3u8_url') || this.isNew) && this.m3u8_url) {
        // For seeding purposes, use simple base64 encoding
        this.encrypted_url = Buffer.from(this.m3u8_url).toString('base64');
    }
    next();
});

// Method to encrypt URL
channelSchema.methods.encryptUrl = function (url) {
    const secret = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(url, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
};

// Method to decrypt URL
channelSchema.methods.decryptUrl = function () {
    const secret = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(this.encrypted_url, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

// Method to generate secure streaming token
channelSchema.methods.generateStreamToken = function (userId, expiresIn = 3600) {
    const payload = {
        channelId: this._id,
        userId: userId,
        exp: Math.floor(Date.now() / 1000) + expiresIn,
        iat: Math.floor(Date.now() / 1000)
    };

    return crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'your-jwt-secret')
        .update(JSON.stringify(payload))
        .digest('hex');
};

// Hide sensitive data when converting to JSON
channelSchema.methods.toJSON = function () {
    const channelObject = this.toObject();
    delete channelObject.m3u8_url;
    delete channelObject.encrypted_url;
    return channelObject;
};

// Static method to get channels by category
channelSchema.statics.getByCategory = function (categoryId, isPremium = false) {
    const query = {
        category_id: categoryId,
        status: 'active',
        is_online: true
    };

    if (!isPremium) {
        query.is_premium = false;
    }

    return this.find(query)
        .populate('category_id', 'name slug')
        .sort({ sort_order: 1, name: 1 });
};

// Static method to get free channels
channelSchema.statics.getFreeChannels = function () {
    return this.find({
        is_premium: false,
        status: 'active',
        is_online: true
    })
        .populate('category_id', 'name slug')
        .sort({ sort_order: 1, name: 1 });
};

// Method to increment viewer count
channelSchema.methods.incrementViewerCount = async function () {
    this.viewer_count = (this.viewer_count || 0) + 1;
    return await this.save();
};

module.exports = mongoose.model('Channel', channelSchema);
