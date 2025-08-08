const express = require('express');
const router = express.Router();
const watchHistoryController = require('../controllers/watchHistoryController');
const verifyToken = require('../middlewares/verifyToken');

// Protected routes (authentication required)
router.get('/my-history', verifyToken, watchHistoryController.getUserWatchHistory);
router.post('/add', verifyToken, watchHistoryController.addWatchHistory);
router.put('/:historyId/duration', verifyToken, watchHistoryController.updateWatchDuration);
router.delete('/clear', verifyToken, watchHistoryController.clearWatchHistory);
router.delete('/:historyId', verifyToken, watchHistoryController.removeWatchHistoryEntry);
router.get('/stats/my-stats', verifyToken, watchHistoryController.getUserWatchStats);

// Admin routes (protected + admin access required)
router.get('/admin/all', verifyToken, watchHistoryController.getAllWatchHistory);
router.get('/admin/channel/:channelId/analytics', verifyToken, watchHistoryController.getChannelAnalytics);

module.exports = router; 