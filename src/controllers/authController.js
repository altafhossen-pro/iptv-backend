// controllers/authController.js
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const jwt = require('jsonwebtoken');
const sendResponse = require('../utils/sendResponse');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '7d' }
    );
};

// Helper function to validate input
const validateLoginInput = (identifier, password) => {
    if (!identifier || !password) {
        return { isValid: false, message: 'SID/Email and password are required' };
    }
    
    if (password.length < 6) {
        return { isValid: false, message: 'Password must be at least 6 characters long' };
    }
    
    return { isValid: true };
};

// Register new user
exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        if (password.length < 6) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create new user (SID will be auto-generated in pre-save middleware)
        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            phone
        });

        await user.save();

        // Create free subscription for new user
        const subscription = new Subscription({
            user_id: user._id,
            subscription_type: 'free'
        });

        await subscription.save();

        // Generate token
        const token = generateToken(user._id);

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'User registered successfully',
            data: {
                user: user.toJSON(),
                sid: user.sid, // Include SID in response
                token,
                subscription: subscription
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate key error for SID (should be rare due to pre-save middleware)
        if (error.code === 11000 && error.keyValue?.sid) {
            return sendResponse({
                res,
                statusCode: 500,
                success: false,
                message: 'Error generating user ID. Please try again.'
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during registration'
        });
    }
};

// Login user (supports both SID and email)
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body; // 'identifier' can be SID or email

        // Validate input
        const validation = validateLoginInput(identifier, password);
        if (!validation.isValid) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: validation.message
            });
        }

        // Find user by SID or email
        const user = await User.findByIdentifier(identifier);
        if (!user) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid SID/Email or password'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid SID/Email or password'
            });
        }

        // Update last login
        await user.updateLastLogin();

        // Get user's subscription
        const subscription = await Subscription.getActiveByUser(user._id);

        // Generate token
        const token = generateToken(user._id);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Login successful',
            data: {
                user: user.toJSON(),
                sid: user.sid,
                token,
                subscription,
                loginMethod: /^\d+$/.test(identifier) ? 'SID' : 'Email'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during login'
        });
    }
};

// Email-only login (backward compatibility)
exports.emailLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase(), status: 'active' });
        if (!user) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        await user.updateLastLogin();

        // Get user's subscription
        const subscription = await Subscription.getActiveByUser(user._id);

        // Generate token
        const token = generateToken(user._id);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Login successful',
            data: {
                user: user.toJSON(),
                sid: user.sid,
                token,
                subscription
            }
        });

    } catch (error) {
        console.error('Email login error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during login'
        });
    }
};

// SID-only login
exports.sidLogin = async (req, res) => {
    try {
        const { sid, password } = req.body;

        if (!sid || !password) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'SID and password are required'
            });
        }

        // Find user by SID
        const user = await User.findOne({ sid, status: 'active' });
        if (!user) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid SID or password'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return sendResponse({
                res,
                statusCode: 401,
                success: false,
                message: 'Invalid SID or password'
            });
        }

        // Update last login
        await user.updateLastLogin();

        // Get user's subscription
        const subscription = await Subscription.getActiveByUser(user._id);

        // Generate token
        const token = generateToken(user._id);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'SID login successful',
            data: {
                user: user.toJSON(),
                sid: user.sid,
                token,
                subscription
            }
        });

    } catch (error) {
        console.error('SID login error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during SID login'
        });
    }
};

// Google OAuth login/register
exports.googleAuth = async (req, res) => {
    try {
        const { googleId, name, email, avatar } = req.body;

        let user = await User.findOne({
            $or: [{ googleId }, { email: email.toLowerCase() }]
        });

        if (user) {
            // Update existing user with Google ID if not set
            if (!user.googleId && user.email === email.toLowerCase()) {
                user.googleId = googleId;
                user.avatar = avatar || user.avatar;
                await user.save();
            }

            await user.updateLastLogin();
        } else {
            // Create new user (SID will be auto-generated)
            user = new User({
                name,
                email: email.toLowerCase(),
                googleId,
                avatar
            });

            await user.save();

            // Create free subscription for new user
            const subscription = new Subscription({
                user_id: user._id,
                subscription_type: 'free'
            });

            await subscription.save();
        }

        // Get user's subscription
        const subscription = await Subscription.getActiveByUser(user._id);

        // Generate token
        const token = generateToken(user._id);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Google authentication successful',
            data: {
                user: user.toJSON(),
                sid: user.sid,
                token,
                subscription
            }
        });

    } catch (error) {
        console.error('Google auth error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during Google authentication'
        });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId, '-password');
        const subscription = await Subscription.getActiveByUser(req.user.userId);

        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user,
                sid: user.sid,
                subscription
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving profile'
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, avatar } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name, phone, avatar },
            { new: true, select: '-password' }
        );

        if (!user) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'User not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Profile updated successfully',
            data: { 
                user,
                sid: user.sid 
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating profile'
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(req.user.userId);

        // Check if user has password (Google OAuth users might not)
        if (!user.password) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Cannot change password for Google OAuth accounts'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while changing password'
        });
    }
};

// Get user by SID (admin function)
exports.getUserBySID = async (req, res) => {
    try {
        const { sid } = req.params;

        const user = await User.findOne({ sid }, '-password')
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
            message: 'User found',
            data: {
                user,
                subscription
            }
        });

    } catch (error) {
        console.error('Get user by SID error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving user'
        });
    }
};

// Check SID availability
exports.checkSIDAvailability = async (req, res) => {
    try {
        const { sid } = req.params;

        const existingUser = await User.sidExists(sid);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'SID availability checked',
            data: {
                sid,
                isAvailable: !existingUser,
                exists: !!existingUser
            }
        });

    } catch (error) {
        console.error('Check SID availability error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while checking SID availability'
        });
    }
};

// Logout (client-side token removal)
exports.logout = async (req, res) => {
    try {
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error during logout'
        });
    }
};

module.exports = exports;