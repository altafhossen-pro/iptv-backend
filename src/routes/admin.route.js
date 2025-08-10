const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const verifyToken = require('../middlewares/verifyToken');

// Public routes (no authentication required)
router.get('/get-dashboard', verifyToken, adminController.getLoadDataForDashboard);

module.exports = router;