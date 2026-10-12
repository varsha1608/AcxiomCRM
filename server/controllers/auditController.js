const AuditLog = require('../models/AuditLog');

// @desc    Get audit logs with search and filters (Admin only)
// @route   GET /api/audit-logs
// @access  Private/Admin
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      search,
      entityName,
      action,
      result,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};

    if (entityName && entityName !== 'All') {
      filter.entityName = entityName;
    }
    if (action && action !== 'All') {
      filter.action = action;
    }
    if (result && result !== 'All') {
      filter.result = result;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { userName: searchRegex },
        { action: searchRegex },
        { entityName: searchRegex },
        { details: searchRegex },
        { ipAddress: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: logs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
