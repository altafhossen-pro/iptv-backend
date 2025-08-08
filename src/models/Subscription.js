// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    subscription_type: {
        type: String,
        enum: ['free', 'basic', 'premium', 'vip'],
        default: 'free'
    },
    start_date: {
        type: Date,
        default: Date.now
    },
    end_date: {
        type: Date,
        required: function () {
            return this.subscription_type !== 'free';
        }
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'suspended'],
        default: 'active'
    },
    auto_renewal: {
        type: Boolean,
        default: false
    },
    grace_period_end: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for efficient queries
subscriptionSchema.index({ user_id: 1, status: 1 });
subscriptionSchema.index({ end_date: 1, status: 1 });

// Virtual to check if subscription is active
subscriptionSchema.virtual('isActive').get(function () {
    if (this.subscription_type === 'free') return true;
    return this.status === 'active' && this.end_date > new Date();
});

// Virtual to check days remaining
subscriptionSchema.virtual('daysRemaining').get(function () {
    if (this.subscription_type === 'free') return null;
    if (this.status !== 'active') return 0;

    const now = new Date();
    const endDate = new Date(this.end_date);
    const timeDiff = endDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return Math.max(0, daysDiff);
});

// Method to check if subscription allows premium access
subscriptionSchema.methods.hasPremiumAccess = function () {
    if (this.subscription_type === 'free') return false;
    return this.isActive;
};

// Method to extend subscription
subscriptionSchema.methods.extend = async function (days) {
    const currentEndDate = this.end_date > new Date() ? this.end_date : new Date();
    this.end_date = new Date(currentEndDate.getTime() + (days * 24 * 60 * 60 * 1000));
    this.status = 'active';
    return await this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function () {
    this.status = 'cancelled';
    this.auto_renewal = false;
    return await this.save();
};

// Static method to get user's active subscription
subscriptionSchema.statics.getActiveByUser = function (userId) {
    return this.findOne({
        user_id: userId,
        status: 'active'
    }).populate('user_id', 'name email');
};

// Static method to get expiring subscriptions (for notifications)
subscriptionSchema.statics.getExpiring = function (days = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.find({
        status: 'active',
        subscription_type: { $ne: 'free' },
        end_date: {
            $gte: new Date(),
            $lte: futureDate
        }
    }).populate('user_id', 'name email');
};

// Static method to expire old subscriptions
subscriptionSchema.statics.expireOldSubscriptions = async function () {
    const result = await this.updateMany({
        status: 'active',
        subscription_type: { $ne: 'free' },
        end_date: { $lt: new Date() }
    }, {
        status: 'expired'
    });

    return result.modifiedCount;
};

// Pre-save middleware to set end_date for free subscriptions
subscriptionSchema.pre('save', function (next) {
    if (this.subscription_type === 'free') {
        this.end_date = null;
        this.auto_renewal = false;
    }
    next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);