const FollowUp = require('../models/FollowUp');
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

// @desc    Get all follow-ups with filters
// @route   GET /api/followups
// @access  Authenticated
const getFollowUps = async (req, res, next) => {
  try {
    const { status, type, filterType, page = 1, limit = 50 } = req.query;

    const baseFilter = buildRoleFilter(req.user);
    const filter = { ...baseFilter };

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (type && type !== 'All') {
      filter.followUpType = type;
    }

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (filterType === 'upcoming') {
      filter.followUpDate = { $gte: now };
      filter.status = 'Planned';
    } else if (filterType === 'overdue') {
      filter.followUpDate = { $lt: now };
      filter.status = 'Planned';
    } else if (filterType === 'today') {
      filter.followUpDate = { $gte: todayStart, $lte: todayEnd };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await FollowUp.countDocuments(filter);
    const followUps = await FollowUp.find(filter)
      .populate('customerId', 'customerCode customerName email phone companyName')
      .populate('leadId', 'leadCode leadName email phone')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email')
      .sort({ followUpDate: 1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: followUps.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: followUps
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new follow-up
// @route   POST /api/followups
// @access  Authenticated
const createFollowUp = async (req, res, next) => {
  try {
    const {
      relatedType = 'Customer',
      customerId,
      leadId,
      followUpDate,
      followUpType = 'Call',
      subject,
      remarks,
      status = 'Planned',
      assignedTo
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required'
      });
    }

    if (!followUpDate) {
      return res.status(400).json({
        success: false,
        message: 'Follow-up date is required'
      });
    }

    const dateVal = new Date(followUpDate);
    if (isNaN(dateVal.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid follow-up date and time'
      });
    }

    // Business validation: Cannot be earlier than today for a new/planned follow-up
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status === 'Planned' && dateVal < today) {
      return res.status(400).json({
        success: false,
        message: 'Follow-up date cannot be earlier than today.'
      });
    }

    const validTypes = ['Call', 'Meeting', 'Email', 'Demo', 'Task'];
    if (followUpType && !validTypes.includes(followUpType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid follow-up type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const validStatuses = ['Planned', 'Completed', 'Missed', 'Rescheduled', 'Cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid follow-up status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (relatedType === 'Customer') {
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer is required for customer follow-up'
        });
      }
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Selected Customer does not exist'
        });
      }
    } else if (relatedType === 'Lead') {
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: 'Lead is required for lead follow-up'
        });
      }
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

    const followUp = await FollowUp.create({
      relatedType,
      customerId: relatedType === 'Customer' ? customerId : null,
      leadId: relatedType === 'Lead' ? leadId : null,
      followUpDate: dateVal,
      followUpType,
      subject: subject.trim(),
      remarks: remarks ? remarks.trim() : '',
      status,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      completedAt: status === 'Completed' ? new Date() : null
    });

    const populated = await FollowUp.findById(followUp._id)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role');

    await logAudit({
      req,
      action: 'CREATE',
      entityName: 'FollowUp',
      recordId: followUp._id,
      details: `Scheduled follow-up '${followUp.subject}' on ${dateVal.toLocaleDateString()}`,
      result: 'SUCCESS',
      newValue: {
        subject: followUp.subject,
        followUpDate: followUp.followUpDate,
        followUpType: followUp.followUpType,
        status: followUp.status
      }
    });

    res.status(201).json({
      success: true,
      message: 'Follow-up scheduled successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get follow-up by ID
// @route   GET /api/followups/:id
// @access  Authenticated
const getFollowUpById = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email');

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      followUp.assignedTo?._id?.toString() !== req.user._id.toString() &&
      followUp.createdBy?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view follow-ups assigned to you.'
      });
    }

    res.json({
      success: true,
      data: followUp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update follow-up
// @route   PUT /api/followups/:id
// @access  Authenticated
const updateFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      followUp.assignedTo?.toString() !== req.user._id.toString() &&
      followUp.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update follow-ups assigned to you.'
      });
    }

    const {
      followUpDate,
      followUpType,
      subject,
      remarks,
      status,
      assignedTo
    } = req.body;

    if (subject !== undefined) {
      if (!subject || !subject.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot be empty'
        });
      }
      if (subject.length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot exceed 150 characters'
        });
      }
    }

    if (followUpType) {
      const validTypes = ['Call', 'Meeting', 'Email', 'Demo', 'Task'];
      if (!validTypes.includes(followUpType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid follow-up type. Must be one of: ${validTypes.join(', ')}`
        });
      }
    }

    if (status) {
      const validStatuses = ['Planned', 'Completed', 'Missed', 'Rescheduled', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid follow-up status. Must be one of: ${validStatuses.join(', ')}`
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

    if (followUpDate) {
      const dateVal = new Date(followUpDate);
      if (isNaN(dateVal.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid follow-up date'
        });
      }
      followUp.followUpDate = dateVal;
    }

    const oldValues = {
      subject: followUp.subject,
      status: followUp.status,
      followUpDate: followUp.followUpDate,
      assignedTo: followUp.assignedTo
    };

    if (subject) followUp.subject = subject.trim();
    if (followUpType) followUp.followUpType = followUpType;
    if (remarks !== undefined) followUp.remarks = remarks.trim();
    if (assignedTo !== undefined) followUp.assignedTo = assignedTo;

    if (status) {
      followUp.status = status;
      if (status === 'Completed' && !followUp.completedAt) {
        followUp.completedAt = new Date();
      }
    }

    await followUp.save();

    const updated = await FollowUp.findById(followUp._id)
      .populate('customerId', 'customerCode customerName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role');

    await logAudit({
      req,
      action: 'UPDATE',
      entityName: 'FollowUp',
      recordId: followUp._id,
      details: `Updated follow-up '${followUp.subject}' (Status: ${followUp.status})`,
      result: 'SUCCESS',
      oldValue: oldValues,
      newValue: {
        subject: followUp.subject,
        status: followUp.status,
        followUpDate: followUp.followUpDate
      }
    });

    res.json({
      success: true,
      message: 'Follow-up updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete follow-up
// @route   DELETE /api/followups/:id
// @access  Authenticated
const deleteFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      followUp.assignedTo?.toString() !== req.user._id.toString() &&
      followUp.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete follow-ups assigned to you.'
      });
    }

    await FollowUp.findByIdAndDelete(followUp._id);

    await logAudit({
      req,
      action: 'DELETE',
      entityName: 'FollowUp',
      recordId: followUp._id,
      details: `Deleted follow-up '${followUp.subject}'`,
      result: 'SUCCESS',
      oldValue: { subject: followUp.subject, status: followUp.status }
    });

    res.json({
      success: true,
      message: 'Follow-up deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFollowUps,
  getFollowUpById,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp
};
