const express = require('express');
const router = express.Router();
const { getReportData } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:reportType', protect, getReportData);

module.exports = router;
