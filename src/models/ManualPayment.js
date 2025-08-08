// models/Payment.js
const mongoose = require('mongoose');

const manualPaymentSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    months: {
        type: Number,
        required: [true, 'Month is required'],
        min: 1,
        max: 12
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount must be positive']
    },
    senderNumber: {
        type: String,
        required: [true, 'Sender number is required'],
        trim: true
    },
    transaction_id: {
        type: String,
        unique: true,
        required: [true, 'Transaction ID is required']
    },
    payment_method: {
        type: String,
        default: 'manual',
    },
    payment_status: {
        type: String,
        enum: ['pending', 'completed', 'confirmed', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },

}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});


module.exports = mongoose.model('ManualPayment', manualPaymentSchema);