// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    sid: {
        type: String,
        unique: true,
        required: true,
        index: true,
        default: function() {
            // This will be overridden by pre-validate middleware
            return 'TEMP_' + Date.now();
        }
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId; // Password required only if not using Google OAuth
        }
    },
    googleId: {
        type: String,
        sparse: true // Allows multiple null values but unique non-null values
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    avatar: {
        type: String,
        default: null
    },
    phone: {
        type: String,
        default: null
    },
    last_login: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    
    is_admin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Additional indexes for better performance
userSchema.index({ sid: 1 });
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });

// Static method to generate next SID
userSchema.statics.generateNextSID = async function() {
    try {
        // Find the user with the highest SID
        const lastUser = await this.findOne({}, { sid: 1 })
            .sort({ sid: -1 })
            .lean();
        
        if (!lastUser) {
            // First user, start with 100001
            return '100001';
        }
        
        // Extract numeric part and increment
        const lastSIDNumber = parseInt(lastUser.sid);
        const nextSIDNumber = lastSIDNumber + 1;
        
        return nextSIDNumber.toString();
    } catch (error) {
        throw new Error('Error generating SID: ' + error.message);
    }
};

// Static method to find user by SID or email
userSchema.statics.findByIdentifier = function(identifier) {
    // Check if identifier looks like SID (only numbers) or email (contains @)
    const isSID = /^\d+$/.test(identifier);
    
    if (isSID) {
        return this.findOne({ sid: identifier, status: 'active' });
    } else {
        return this.findOne({ email: identifier.toLowerCase(), status: 'active' });
    }
};

// Static method to check if SID exists
userSchema.statics.sidExists = function(sid) {
    return this.findOne({ sid });
};

// Virtual to display user identifier (for UI purposes)
userSchema.virtual('userIdentifier').get(function() {
    return `SID: ${this.sid}`;
});

// Pre-validate middleware to generate SID before validation
userSchema.pre('validate', async function(next) {
    try {
        // Generate SID for new users before validation
        if (this.isNew && (!this.sid || this.sid.startsWith('TEMP_'))) {
            this.sid = await this.constructor.generateNextSID();
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    try {
        // Hash password if modified
        if (!this.isModified('password')) return next();
        
        if (this.password) {
            const salt = await bcrypt.genSalt(12);
            this.password = await bcrypt.hash(this.password, salt);
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to ensure SID uniqueness (extra safety)
userSchema.pre('save', async function(next) {
    if (this.isNew && this.sid) {
        const existingUser = await this.constructor.findOne({ 
            sid: this.sid, 
            _id: { $ne: this._id } 
        });
        if (existingUser) {
            // If somehow SID exists, generate a new one
            this.sid = await this.constructor.generateNextSID();
        }
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Hide sensitive data when converting to JSON
userSchema.methods.toJSON = function () {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.googleId;
    return userObject;
};

// Update last login
userSchema.methods.updateLastLogin = async function () {
    this.last_login = new Date();
    return await this.save();
};

// Method to get user display info
userSchema.methods.getDisplayInfo = function() {
    return {
        sid: this.sid,
        name: this.name,
        email: this.email,
        avatar: this.avatar,
        status: this.status,
        created_at: this.created_at,
        last_login: this.last_login
    };
};

// Method to reset SID (admin only - dangerous operation)
userSchema.methods.resetSID = async function() {
    const newSID = await this.constructor.generateNextSID();
    this.sid = newSID;
    return await this.save();
};

module.exports = mongoose.model('User', userSchema);