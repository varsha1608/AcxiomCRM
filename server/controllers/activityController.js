const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

const buildRoleFilter = (user) => {
  if (user.role === 'Admin' || user.role === 'Manager') {
    return {};
  }
  return {
    $or: [{ assignedTo: user._id }, { createdBy: user._id }]
  };
};

// @desc    Get all activities with filtering
// @route   GET /api/activities
// @access  Authenticated
const getActivities = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 50 } = req.query;

    const baseFilter = buildRoleFilter(req.user);
    const filter = { ...baseFilter };

    if (type && type !== 'All') {
      filter.activityType = type;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Activity.countDocuments(filter);
    const activities = await Activity.find(filter)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email')
      .sort({ activityDate: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: activities.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create activity
// @route   POST /api/activities
// @access  Authenticated
const createActivity = async (req, res, next) => {
  try {
    const {
      activityType = 'Call',
      subject,
      description,
      activityDate,
      customerId,
      leadId,
      assignedTo,
      status = 'Completed'
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required'
      });
    }

    if (subject.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Subject cannot exceed 150 characters'
      });
    }

    const validTypes = ['Call', 'Meeting', 'Email', 'Task'];
    if (!activityType || !validTypes.includes(activityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid activity type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    let parsedDate = new Date();
    if (activityDate) {
      parsedDate = new Date(activityDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid activity date'
        });
      }
    }

    const validStatuses = ['Planned', 'Completed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (customerId) {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Selected Customer does not exist'
        });
      }
    }

    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Selected Lead does not exist'
        });
      }
    }

    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not exist'
        });
      }
    }

    const activity = await Activity.create({
      activityType,
      subject: subject.trim(),
      description: description ? description.trim() : '',
      activityDate: parsedDate,
      customerId: customerId || null,
      leadId: leadId || null,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      status
    });

    const populated = await Activity.findById(activity._id)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role');

    await logAudit({
      req,
      action: 'CREATE',
      entityName: 'Activity',
      recordId: activity._id,
      details: `Logged ${activity.activityType} activity: '${activity.subject}'`,
      result: 'SUCCESS',
      newValue: {
        activityType: activity.activityType,
        subject: activity.subject,
        status: activity.status
      }
    });

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity by ID
// @route   GET /api/activities/:id
// @access  Authenticated
const getActivityById = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email');

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      activity.assignedTo?._id?.toString() !== req.user._id.toString() &&
      activity.createdBy?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view activities assigned to you.'
      });
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete activity
// @route   DELETE /api/activities/:id
// @access  Authenticated
const deleteActivity = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      activity.assignedTo?.toString() !== req.user._id.toString() &&
      activity.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete activities assigned to you.'
      });
    }

    await Activity.findByIdAndDelete(activity._id);

    await logAudit({
      req,
      action: 'DELETE',
      entityName: 'Activity',
      recordId: activity._id,
      details: `Deleted activity: '${activity.subject}'`,
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivities,
  getActivityById,
  createActivity,
  deleteActivity
};
