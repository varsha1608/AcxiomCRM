const Opportunity = require('../models/Opportunity');
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

// @desc    Get all opportunities with search and filter
// @route   GET /api/opportunities
// @access  Authenticated
const getOpportunities = async (req, res, next) => {
  try {
    const { search, stage, status, page = 1, limit = 50 } = req.query;

    const baseFilter = buildRoleFilter(req.user);
    const filter = { ...baseFilter };

    if (stage && stage !== 'All') {
      filter.stage = stage;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      // Find matching customers first
      const matchedCustomers = await Customer.find({ customerName: searchRegex }).select('_id');
      const customerIds = matchedCustomers.map((c) => c._id);

      const searchConditions = [
        { opportunityName: searchRegex },
        { customerId: { $in: customerIds } }
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

    const total = await Opportunity.countDocuments(filter);
    const opportunities = await Opportunity.find(filter)
      .populate('customerId', 'customerCode customerName email phone companyName')
      .populate('leadId', 'leadCode leadName')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: opportunities.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: opportunities
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get opportunity by ID
// @route   GET /api/opportunities/:id
// @access  Authenticated
const getOpportunityById = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate('customerId', 'customerCode customerName email phone companyName address city state')
      .populate('leadId', 'leadCode leadName email phone')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email');

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      opportunity.assignedTo?._id?.toString() !== req.user._id.toString() &&
      opportunity.createdBy?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view opportunities assigned to you.'
      });
    }

    res.json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new opportunity
// @route   POST /api/opportunities
// @access  Authenticated
const createOpportunity = async (req, res, next) => {
  try {
    const {
      opportunityName,
      customerId,
      leadId,
      amount,
      stage = 'Qualification',
      probability = 20,
      expectedCloseDate,
      notes,
      assignedTo
    } = req.body;

    // Required fields check
    if (!opportunityName || !opportunityName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity name is required'
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer is required'
      });
    }

    // Verify Customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Selected Customer does not exist'
      });
    }

    // Business validation: Amount must be > 0
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Opportunity Amount must be greater than 0.'
      });
    }

    // Business validation: Probability 0 to 100
    const numProb = Number(probability);
    if (isNaN(numProb) || numProb < 0 || numProb > 100) {
      return res.status(400).json({
        success: false,
        message: 'Probability must be between 0 and 100.'
      });
    }

    // Business validation: Expected close date cannot be in the past for active opportunity
    if (!expectedCloseDate) {
      return res.status(400).json({
        success: false,
        message: 'Expected close date is required.'
      });
    }

    const closeDate = new Date(expectedCloseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (stage !== 'Won' && stage !== 'Lost' && closeDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Expected Close Date cannot be in the past.'
      });
    }

    const validStages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
    if (stage && !validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        message: `Invalid opportunity stage. Must be one of: ${validStages.join(', ')}`
      });
    }

    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        return res.status(400).json({
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

    // Determine status based on stage
    let status = 'Open';
    if (stage === 'Won') status = 'Won';
    if (stage === 'Lost') status = 'Lost';

    const opportunity = await Opportunity.create({
      opportunityName: opportunityName.trim(),
      customerId,
      leadId: leadId || null,
      amount: numAmount,
      stage,
      probability: numProb,
      expectedCloseDate: closeDate,
      status,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      notes: notes ? notes.trim() : ''
    });

    const populated = await Opportunity.findById(opportunity._id)
      .populate('customerId', 'customerCode customerName')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'CREATE',
      entityName: 'Opportunity',
      recordId: opportunity._id,
      details: `Created opportunity ${opportunity.opportunityName} with amount $${opportunity.amount} (${opportunity.stage})`,
      result: 'SUCCESS',
      newValue: {
        opportunityName: opportunity.opportunityName,
        amount: opportunity.amount,
        stage: opportunity.stage,
        probability: opportunity.probability,
        status: opportunity.status
      }
    });

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update opportunity
// @route   PUT /api/opportunities/:id
// @access  Authenticated
const updateOpportunity = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    if (
      req.user.role === 'Sales Executive' &&
      opportunity.assignedTo?.toString() !== req.user._id.toString() &&
      opportunity.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update opportunities assigned to you.'
      });
    }

    const {
      opportunityName,
      customerId,
      leadId,
      amount,
      stage,
      probability,
      expectedCloseDate,
      notes,
      assignedTo
    } = req.body;

    if (opportunityName !== undefined) {
      if (!opportunityName || !opportunityName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity name cannot be empty'
        });
      }
      if (opportunityName.length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity name cannot exceed 150 characters'
        });
      }
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
        return res.status(400).json({
          success: false,
          message: 'Selected Lead does not exist'
        });
      }
    }

    if (stage) {
      const validStages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
      if (!validStages.includes(stage)) {
        return res.status(400).json({
          success: false,
          message: `Invalid opportunity stage. Must be one of: ${validStages.join(', ')}`
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

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity Amount must be greater than 0.'
        });
      }
      opportunity.amount = numAmount;
    }

    if (probability !== undefined) {
      const numProb = Number(probability);
      if (isNaN(numProb) || numProb < 0 || numProb > 100) {
        return res.status(400).json({
          success: false,
          message: 'Probability must be between 0 and 100.'
        });
      }
      opportunity.probability = numProb;
    }

    const targetStage = stage || opportunity.stage;

    if (expectedCloseDate) {
      const closeDate = new Date(expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (targetStage !== 'Won' && targetStage !== 'Lost' && closeDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Expected Close Date cannot be in the past.'
        });
      }
      opportunity.expectedCloseDate = closeDate;
    }

    const oldValues = {
      opportunityName: opportunity.opportunityName,
      amount: opportunity.amount,
      stage: opportunity.stage,
      probability: opportunity.probability,
      status: opportunity.status,
      assignedTo: opportunity.assignedTo
    };

    if (opportunityName) opportunity.opportunityName = opportunityName.trim();
    if (customerId) opportunity.customerId = customerId;
    if (leadId !== undefined) opportunity.leadId = leadId || null;
    if (stage) {
      opportunity.stage = stage;
      if (stage === 'Won') {
        opportunity.status = 'Won';
        opportunity.probability = 100;
      } else if (stage === 'Lost') {
        opportunity.status = 'Lost';
        opportunity.probability = 0;
      } else {
        opportunity.status = 'Open';
      }
    }
    if (assignedTo !== undefined) opportunity.assignedTo = assignedTo;
    if (notes !== undefined) opportunity.notes = notes.trim();

    await opportunity.save();

    const updated = await Opportunity.findById(opportunity._id)
      .populate('customerId', 'customerCode customerName')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'UPDATE',
      entityName: 'Opportunity',
      recordId: opportunity._id,
      details: `Updated opportunity ${opportunity.opportunityName} to stage ${opportunity.stage}`,
      result: 'SUCCESS',
      oldValue: oldValues,
      newValue: {
        opportunityName: opportunity.opportunityName,
        amount: opportunity.amount,
        stage: opportunity.stage,
        probability: opportunity.probability,
        status: opportunity.status,
        assignedTo: opportunity.assignedTo
      }
    });

    res.json({
      success: true,
      message: 'Opportunity updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete opportunity
// @route   DELETE /api/opportunities/:id
// @access  Authenticated (Admin / Manager)
const deleteOpportunity = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    if (req.user.role === 'Sales Executive') {
      return res.status(403).json({
        success: false,
        message: 'Sales Executives cannot delete opportunities. Contact an Administrator or Manager.'
      });
    }

    const oldValues = {
      opportunityName: opportunity.opportunityName,
      amount: opportunity.amount,
      stage: opportunity.stage
    };

    await Opportunity.findByIdAndDelete(opportunity._id);

    await logAudit({
      req,
      action: 'DELETE',
      entityName: 'Opportunity',
      recordId: opportunity._id,
      details: `Deleted opportunity ${opportunity.opportunityName}`,
      result: 'SUCCESS',
      oldValue: oldValues
    });

    res.json({
      success: true,
      message: `Opportunity ${opportunity.opportunityName} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity
};
