const express = require('express');

const router = express.Router();

const otpController = require('../controllers/otp.controller');

// 👤 USER ROUTES
router.post('/send-otp', otpController.sendOTP);
router.post('/verify-otp', otpController.verifyOTP);
router.post('/resend', otpController.resendOTP);

module.exports = router;