// models/Category.js
const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        unique: true
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
    icon: {
        type: String,
        default: null
    },
    sort_order: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Auto-generate slug from name
categorySchema.pre('save', function (next) {
    if (this.isModified('name') || this.isNew) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
        });
    }
    next();
});

// Virtual for channel count
categorySchema.virtual('channelCount', {
    ref: 'Channel',
    localField: '_id',
    foreignField: 'category_id',
    count: true
});

// Static method to get active categories
categorySchema.statics.getActiveCategories = function () {
    return this.find({ status: 'active' }).sort({ sort_order: 1, name: 1 });
};

module.exports = mongoose.model('Category', categorySchema);