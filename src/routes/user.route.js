const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const verifyToken = require('../middlewares/verifyToken');

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/email-login', authController.emailLogin);
router.post('/sid-login', authController.sidLogin);
router.post('/google-auth', authController.googleAuth);

// Public utility routes
router.get('/check-sid/:sid', authController.checkSIDAvailability);

// Protected routes (authentication required)
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile', verifyToken, authController.updateProfile);
router.put('/change-password', verifyToken, authController.changePassword);
router.post('/logout', verifyToken, authController.logout);

// User watch history routes
router.get('/watch-history', verifyToken, userController.getUserWatchHistory);
router.delete('/watch-history', verifyToken, userController.clearWatchHistory);

// Admin routes (protected + admin access required)
router.get('/admin/all', verifyToken, userController.getAllUsers);
router.get('/admin/:userId', verifyToken, userController.getUserById);
router.put('/admin/:userId', verifyToken, userController.updateUser);
router.delete('/admin/:userId', verifyToken, userController.deleteUser);
router.get('/admin/:userId/stats', verifyToken, userController.getUserStats);
router.get('/admin/user/:sid', verifyToken, authController.getUserBySID);

module.exports = router;