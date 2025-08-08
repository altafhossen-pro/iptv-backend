
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');
const Otp = require('../models/Otp');
const { sendOTPEmail } = require('../utils/email');

// Generate random 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Delete any existing OTP for this email
        await Otp.deleteMany({ email });

        // Save new OTP to database
        const newOTP = new Otp({
            email,
            otp
        });

        await newOTP.save();

        await sendOTPEmail(email, otp);


        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
        });

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP'
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Find OTP in database
        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Delete the used OTP
        await Otp.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if there's an existing OTP (rate limiting)
        const existingOTP = await OTP.findOne({ email });

        if (existingOTP) {
            const timeDiff = Date.now() - existingOTP.createdAt.getTime();
            const waitTime = 60000; // 1 minute wait time

            if (timeDiff < waitTime) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil((waitTime - timeDiff) / 1000)} seconds before requesting new OTP`
                });
            }
        }

        // Generate new OTP
        const otp = generateOTP();

        // Delete old OTP and save new one
        await OTP.deleteMany({ email });

        const newOTP = new OTP({
            email,
            otp
        });

        await newOTP.save();

        // Send email logic here (same as sendOTP)

        res.status(200).json({
            success: true,
            message: 'OTP resent successfully',
            // Remove this in production
            otp: otp // Only for testing purposes
        });

    } catch (error) {
        console.error('Resend OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP'
        });
    }
};