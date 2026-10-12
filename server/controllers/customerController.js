const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

// Build query filter based on role
const buildRoleFilter = (user) => {
  if (user.role === 'Admin' || user.role === 'Manager') {
    return {};
  }
  // Sales Executive only sees assigned or created customers
  return {
    $or: [{ assignedTo: user._id }, { createdBy: user._id }]
  };
};

// @desc    Get all customers with search & filter
// @route   GET /api/customers
// @access  Authenticated
const getCustomers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;

    const baseFilter = buildRoleFilter(req.user);
    const filter = { ...baseFilter };

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions = [
        { customerName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
        { customerCode: searchRegex }
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

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      count: customers.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer by ID with linked CRM records
// @route   GET /api/customers/:id
// @access  Authenticated
const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Role check for Sales Executive
    if (
      req.user.role === 'Sales Executive' &&
      customer.assignedTo?._id?.toString() !== req.user._id.toString() &&
      customer.createdBy?._id?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view customers assigned to you.'
      });
    }

    // Fetch related records
    const opportunities = await Opportunity.find({ customerId: customer._id }).sort({ createdAt: -1 });
    const followUps = await FollowUp.find({ customerId: customer._id }).sort({ followUpDate: -1 });
    const activities = await Activity.find({ customerId: customer._id }).sort({ activityDate: -1 });

    res.json({
      success: true,
      data: {
        ...customer.toObject(),
        opportunities,
        followUps,
        activities
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Authenticated
const createCustomer = async (req, res, next) => {
  try {
    const {
      customerCode,
      customerName,
      email,
      phone,
      companyName,
      address,
      city,
      state,
      status,
      notes,
      assignedTo
    } = req.body;

    // Server-side validations
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }
    if (customerName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Customer name cannot exceed 100 characters'
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

    // Unique checks
    const existingEmail = await Customer.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'A customer with this email address already exists'
      });
    }

    const existingPhone = await Customer.findOne({ phone: phone.trim() });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'A customer with this phone number already exists'
      });
    }

    const validStatuses = ['Active', 'Inactive', 'Lead', 'Prospect'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid customer status. Must be one of: ${validStatuses.join(', ')}`
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

    const newCustomer = await Customer.create({
      customerCode: customerCode ? customerCode.trim().toUpperCase() : undefined,
      customerName: customerName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      companyName: companyName ? companyName.trim() : '',
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      status: status || 'Active',
      notes: notes ? notes.trim() : '',
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id
    });

    const populated = await Customer.findById(newCustomer._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'CREATE',
      entityName: 'Customer',
      recordId: newCustomer._id,
      details: `Created customer ${newCustomer.customerName} (${newCustomer.customerCode})`,
      result: 'SUCCESS',
      newValue: {
        customerCode: newCustomer.customerCode,
        customerName: newCustomer.customerName,
        email: newCustomer.email,
        phone: newCustomer.phone,
        status: newCustomer.status
      }
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Authenticated
const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Authorization check
    if (
      req.user.role === 'Sales Executive' &&
      customer.assignedTo?.toString() !== req.user._id.toString() &&
      customer.createdBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update customers assigned to you.'
      });
    }

    const {
      customerName,
      email,
      phone,
      companyName,
      address,
      city,
      state,
      status,
      notes,
      assignedTo
    } = req.body;

    if (customerName !== undefined) {
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Customer name cannot be empty'
        });
      }
      if (customerName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Customer name cannot exceed 100 characters'
        });
      }
    }

    if (status !== undefined) {
      const validStatuses = ['Active', 'Inactive', 'Lead', 'Prospect'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid customer status. Must be one of: ${validStatuses.join(', ')}`
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
      const existingEmail = await Customer.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: customer._id }
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'A customer with this email address already exists'
        });
      }
      customer.email = email.toLowerCase().trim();
    }

    if (phone) {
      const phoneRegex = /^[0-9+() -]{7,20}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid phone number (7-20 digits)'
        });
      }
      const existingPhone = await Customer.findOne({
        phone: phone.trim(),
        _id: { $ne: customer._id }
      });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'A customer with this phone number already exists'
        });
      }
      customer.phone = phone.trim();
    }

    const oldValues = {
      customerName: customer.customerName,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      assignedTo: customer.assignedTo
    };

    if (customerName) customer.customerName = customerName.trim();
    if (companyName !== undefined) customer.companyName = companyName.trim();
    if (address !== undefined) customer.address = address.trim();
    if (city !== undefined) customer.city = city.trim();
    if (state !== undefined) customer.state = state.trim();
    if (status !== undefined) customer.status = status;
    if (notes !== undefined) customer.notes = notes.trim();
    if (assignedTo !== undefined) customer.assignedTo = assignedTo;

    await customer.save();

    const updated = await Customer.findById(customer._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    await logAudit({
      req,
      action: 'UPDATE',
      entityName: 'Customer',
      recordId: customer._id,
      details: `Updated customer ${customer.customerName} (${customer.customerCode})`,
      result: 'SUCCESS',
      oldValue: oldValues,
      newValue: {
        customerName: customer.customerName,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        assignedTo: customer.assignedTo
      }
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete or deactivate customer
// @route   DELETE /api/customers/:id
// @access  Authenticated (Admin / Manager)
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (req.user.role === 'Sales Executive') {
      return res.status(403).json({
        success: false,
        message: 'Sales Executives cannot delete customers. Please request an Administrator or Manager.'
      });
    }

    const oldValues = {
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      email: customer.email
    };

    await Customer.findByIdAndDelete(customer._id);

    await logAudit({
      req,
      action: 'DELETE',
      entityName: 'Customer',
      recordId: customer._id,
      details: `Deleted customer ${customer.customerName} (${customer.customerCode})`,
      result: 'SUCCESS',
      oldValue: oldValues
    });

    res.json({
      success: true,
      message: `Customer ${customer.customerName} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
