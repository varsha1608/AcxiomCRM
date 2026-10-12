const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');
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

// @desc    Get all leads with search and filters
// @route   GET /api/leads
// @access  Authenticated
const getLeads = async (req, res, next) => {
  try {
    const { search, status, priority, source, page = 1, limit = 50 } = req.query;

    const baseFilter = buildRoleFilter(req.user);
    const filter = { ...baseFilter };

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }
    if (source && source !== 'All') {
      filter.source = source;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions = [
        { leadName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
        { leadCode: searchRegex }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Lead.countDocuments(filter);
    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email')
      .populate('convertedCustomerId', 'customerCode customerName')
      .populate('convertedOpportunityId', 'opportunityName amount stage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: leads.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: leads
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead by ID
// @route   GET /api/leads/:id
// @access  Authenticated
const getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email')
      .populate('convertedCustomerId', 'customerCode customerName email phone')
      .populate('convertedOpportunityId', 'opportunityName amount stage probability');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      lead.assignedTo?._id?.toString() !== req.user._id.toString() &&
      lead.createdBy?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view leads assigned to you.'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new lead
// @route   POST /api/leads
// @access  Authenticated
const createLead = async (req, res, next) => {
  try {
    const {
      leadCode,
      leadName,
      email,
      phone,
      companyName,
      source,
      status,
      priority,
      expectedValue,
      assignedTo,
      notes
    } = req.body;

    if (!leadName || !leadName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Lead name is mandatory'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address'
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    const phoneRegex = /^[0-9+() -]{7,20}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid phone number (7-20 digits)'
      });
    }

    const validStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid lead status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const numExpectedValue = Number(expectedValue) || 0;
    if (isNaN(numExpectedValue) || numExpectedValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Expected value cannot be negative'
      });
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

    const lead = await Lead.create({
      leadCode: leadCode ? leadCode.trim().toUpperCase() : undefined,
      leadName: leadName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      companyName: companyName ? companyName.trim() : '',
      source: source || 'Website',
      status: status || 'New',
      priority: priority || 'Medium',
      expectedValue: numExpectedValue,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      notes: notes ? notes.trim() : ''
    });

    const populated = await Lead.findById(lead._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'CREATE',
      entityName: 'Lead',
      recordId: lead._id,
      details: `Created lead ${lead.leadName} (${lead.leadCode}) with status ${lead.status}`,
      result: 'SUCCESS',
      newValue: {
        leadCode: lead.leadCode,
        leadName: lead.leadName,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        expectedValue: lead.expectedValue
      }
    });

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Authenticated
const updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      lead.assignedTo?.toString() !== req.user._id.toString() &&
      lead.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update leads assigned to you.'
      });
    }

    const {
      leadName,
      email,
      phone,
      companyName,
      source,
      status,
      priority,
      expectedValue,
      assignedTo,
      notes
    } = req.body;

    if (leadName !== undefined) {
      if (!leadName || !leadName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Lead name cannot be empty'
        });
      }
      if (leadName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Lead name cannot exceed 100 characters'
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

    if (email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid email address'
        });
      }
      lead.email = email.toLowerCase().trim();
    }

    if (phone) {
      const phoneRegex = /^[0-9+() -]{7,20}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid phone number (7-20 digits)'
        });
      }
      lead.phone = phone.trim();
    }

    if (expectedValue !== undefined) {
      const val = Number(expectedValue);
      if (val < 0) {
        return res.status(400).json({
          success: false,
          message: 'Expected value cannot be negative'
        });
      }
      lead.expectedValue = val;
    }

    const validStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid lead status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Workflow validation: Prevent invalid status transitions
    if (lead.status === 'Converted' && status && status !== 'Converted') {
      return res.status(400).json({
        success: false,
        message: 'A converted lead cannot be transitioned back to another status.'
      });
    }
    if (lead.status === 'Lost' && status === 'Converted') {
      return res.status(400).json({
        success: false,
        message: 'A lost lead must be reopened and qualified before conversion.'
      });
    }

    const oldValues = {
      leadName: lead.leadName,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      priority: lead.priority,
      expectedValue: lead.expectedValue,
      assignedTo: lead.assignedTo
    };

    if (leadName) lead.leadName = leadName.trim();
    if (companyName !== undefined) lead.companyName = companyName.trim();
    if (source) lead.source = source;
    if (status) lead.status = status;
    if (priority) lead.priority = priority;
    if (assignedTo !== undefined) lead.assignedTo = assignedTo;
    if (notes !== undefined) lead.notes = notes.trim();

    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'UPDATE',
      entityName: 'Lead',
      recordId: lead._id,
      details: `Updated lead ${lead.leadName} (${lead.leadCode})`,
      result: 'SUCCESS',
      oldValue: oldValues,
      newValue: {
        leadName: lead.leadName,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        priority: lead.priority,
        expectedValue: lead.expectedValue,
        assignedTo: lead.assignedTo
      }
    });

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Convert lead to customer and/or opportunity
// @route   POST /api/leads/:id/convert
// @access  Authenticated
const convertLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (lead.status === 'Converted') {
      return res.status(400).json({
        success: false,
        message: 'This lead has already been converted'
      });
    }

    // Role check for Sales Executive
    if (
      req.user.role === 'Sales Executive' &&
      lead.assignedTo?.toString() !== req.user._id.toString() &&
      lead.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only convert leads assigned to you.'
      });
    }

    const {
      createCustomer = true,
      createOpportunity = true,
      opportunityName,
      opportunityAmount,
      opportunityStage = 'Qualification',
      expectedCloseDate
    } = req.body;

    let customer = null;
    let opportunity = null;

    // 1. Create or link Customer
    if (createCustomer) {
      // Check if customer already exists by email
      customer = await Customer.findOne({ email: lead.email.toLowerCase() });

      if (!customer) {
        // Also check by phone
        customer = await Customer.findOne({ phone: lead.phone });
      }

      if (!customer) {
        customer = await Customer.create({
          customerName: lead.leadName,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName,
          status: 'Active',
          notes: `Converted from Lead ${lead.leadCode}. Notes: ${lead.notes || ''}`,
          assignedTo: lead.assignedTo || req.user._id,
          createdBy: req.user._id
        });

        await logAudit({
          req,
          action: 'CREATE',
          entityName: 'Customer',
          recordId: customer._id,
          details: `Auto-created Customer ${customer.customerName} during conversion of Lead ${lead.leadCode}`,
          result: 'SUCCESS'
        });
      }
    }

    // 2. Create Opportunity if requested
    if (createOpportunity) {
      const oppAmount = Number(opportunityAmount !== undefined ? opportunityAmount : lead.expectedValue) || 1000;
      if (oppAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity Amount must be greater than 0'
        });
      }

      const closeDate = expectedCloseDate
        ? new Date(expectedCloseDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

      if (closeDate < new Date().setHours(0, 0, 0, 0)) {
        return res.status(400).json({
          success: false,
          message: 'Expected Close Date cannot be in the past'
        });
      }

      const effectiveCustomerId = customer ? customer._id : lead.convertedCustomerId;
      if (!effectiveCustomerId) {
        return res.status(400).json({
          success: false,
          message: 'An opportunity requires an associated Customer. Please enable customer creation or specify a customer.'
        });
      }

      opportunity = await Opportunity.create({
        opportunityName: opportunityName || `${lead.companyName || lead.leadName} - Deal`,
        customerId: effectiveCustomerId,
        leadId: lead._id,
        amount: oppAmount,
        stage: opportunityStage,
        probability: opportunityStage === 'Proposal' ? 50 : 25,
        expectedCloseDate: closeDate,
        status: 'Open',
        assignedTo: lead.assignedTo || req.user._id,
        createdBy: req.user._id,
        notes: `Originated from Lead conversion: ${lead.leadCode}`
      });

      await logAudit({
        req,
        action: 'CREATE',
        entityName: 'Opportunity',
        recordId: opportunity._id,
        details: `Auto-created Opportunity ${opportunity.opportunityName} ($${opportunity.amount}) during conversion of Lead ${lead.leadCode}`,
        result: 'SUCCESS'
      });
    }

    // 3. Mark Lead as Converted
    lead.status = 'Converted';
    if (customer) lead.convertedCustomerId = customer._id;
    if (opportunity) lead.convertedOpportunityId = opportunity._id;
    await lead.save();

    await logAudit({
      req,
      action: 'CONVERT_LEAD',
      entityName: 'Lead',
      recordId: lead._id,
      details: `Lead ${lead.leadCode} converted successfully. Customer: ${customer?.customerCode || 'None'}, Opportunity: ${opportunity?.opportunityName || 'None'}`,
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Lead ${lead.leadCode} successfully converted!`,
      data: {
        lead,
        customer,
        opportunity
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Authenticated (Admin / Manager)
const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (req.user.role === 'Sales Executive') {
      return res.status(403).json({
        success: false,
        message: 'Sales Executives cannot delete leads. Contact an Administrator or Manager.'
      });
    }

    const oldValues = {
      leadCode: lead.leadCode,
      leadName: lead.leadName,
      status: lead.status
    };

    await Lead.findByIdAndDelete(lead._id);

    await logAudit({
      req,
      action: 'DELETE',
      entityName: 'Lead',
      recordId: lead._id,
      details: `Deleted lead ${lead.leadName} (${lead.leadCode})`,
      result: 'SUCCESS',
      oldValue: oldValues
    });

    res.json({
      success: true,
      message: `Lead ${lead.leadName} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  convertLead,
  deleteLead
};
