// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    subscription_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null
    },
    transaction_id: {
        type: String,
        unique: true,
        required: [true, 'Transaction ID is required']
    },
    bkash_transaction_id: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount must be positive']
    },
    currency: {
        type: String,
        default: 'BDT',
        enum: ['BDT', 'USD']
    },
    payment_method: {
        type: String,
        enum: ['bkash', 'nagad', 'rocket', 'card','manual'],
        required: [true, 'Payment method is required']
    },
    payment_status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    subscription_duration: {
        type: Number,
        required: [true, 'Subscription duration is required'],
        enum: [30, 90, 365] // days
    },
    subscription_type: {
        type: String,
        enum: ['basic', 'premium', 'vip'],
        required: [true, 'Subscription type is required']
    },
    discount_amount: {
        type: Number,
        default: 0,
        min: [0, 'Discount amount cannot be negative']
    },
    coupon_code: {
        type: String,
        default: null,
        uppercase: true
    },
    payment_date: {
        type: Date,
        default: null
    },
    gateway_response: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    refund_reason: {
        type: String,
        default: null
    },
    refund_date: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for efficient queries
paymentSchema.index({ user_id: 1, payment_status: 1 });
paymentSchema.index({ transaction_id: 1 });
paymentSchema.index({ bkash_transaction_id: 1 });
paymentSchema.index({ payment_date: -1 });

// Virtual for net amount (amount - discount)
paymentSchema.virtual('netAmount').get(function () {
    return this.amount - (this.discount_amount || 0);
});

// Virtual to check if payment is successful
paymentSchema.virtual('isSuccessful').get(function () {
    return this.payment_status === 'completed';
});

// Method to mark payment as completed
paymentSchema.methods.markCompleted = async function (gatewayResponse = {}) {
    this.payment_status = 'completed';
    this.payment_date = new Date();
    this.gateway_response = { ...this.gateway_response, ...gatewayResponse };
    return await this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markFailed = async function (reason, gatewayResponse = {}) {
    this.payment_status = 'failed';
    this.gateway_response = { ...this.gateway_response, error: reason, ...gatewayResponse };
    return await this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = async function (reason) {
    if (this.payment_status !== 'completed') {
        throw new Error('Can only refund completed payments');
    }

    this.payment_status = 'refunded';
    this.refund_reason = reason;
    this.refund_date = new Date();
    return await this.save();
};

// Static method to generate transaction ID
paymentSchema.statics.generateTransactionId = function () {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN_${timestamp}_${random}`;
};

// Static method to get payment history for user
paymentSchema.statics.getPaymentHistory = function (userId, limit = 10, skip = 0) {
    return this.find({ user_id: userId })
        .populate('subscription_id', 'subscription_type start_date end_date')
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get successful payments in date range
paymentSchema.statics.getSuccessfulPayments = function (startDate, endDate) {
    return this.find({
        payment_status: 'completed',
        payment_date: {
            $gte: startDate,
            $lte: endDate
        }
    })
        .populate('user_id', 'name email')
        .sort({ payment_date: -1 });
};

// Static method to get revenue statistics
paymentSchema.statics.getRevenueStats = async function (startDate, endDate) {
    const stats = await this.aggregate([
        {
            $match: {
                payment_status: 'completed',
                payment_date: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalDiscount: { $sum: '$discount_amount' },
                totalTransactions: { $sum: 1 },
                avgTransactionAmount: { $avg: '$amount' }
            }
        }
    ]);

    return stats[0] || {
        totalRevenue: 0,
        totalDiscount: 0,
        totalTransactions: 0,
        avgTransactionAmount: 0
    };
};

// Pre-save middleware to generate transaction ID if not provided
paymentSchema.pre('save', function (next) {
    if (this.isNew && !this.transaction_id) {
        this.transaction_id = this.constructor.generateTransactionId();
    }
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);