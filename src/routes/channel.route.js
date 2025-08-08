const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const verifyToken = require('../middlewares/verifyToken');

// Public routes (no authentication required)
router.get('/', channelController.getAllChannels);
router.get('/free', channelController.getFreeChannels);
router.get('/search', channelController.searchChannels);

// Protected routes (authentication required)
router.get('/category/:categoryId', verifyToken, channelController.getChannelsByCategory);
router.get('/:channelId', verifyToken, channelController.getChannelById);
router.get('/:channelId/stream', verifyToken, channelController.getStreamingUrl);

// Internal/proxy routes for streaming verification
router.get('/:channelId/verify-token', channelController.verifyStreamToken);

// Admin routes (protected + admin access required)
router.post('/', verifyToken,  channelController.createChannel);
router.put('/:channelId', verifyToken,  channelController.updateChannel);
router.delete('/:channelId', verifyToken,  channelController.deleteChannel);
router.put('/:channelId/status', verifyToken,  channelController.updateChannelStatus);
router.put('/:channelId/online-status', verifyToken,  channelController.updateOnlineStatus);

module.exports = router;