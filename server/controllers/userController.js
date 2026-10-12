const User = require('../models/User');
const { hashPassword } = require('../utils/aspnetIdentityHasher');
const { logAudit } = require('../utils/auditLogger');

// Sanitized User DTO
const toUserDTO = (u) => ({
  _id: u._id,
  id: u._id,
  name: u.name,
  userName: u.userName || u.email,
  email: u.email,
  role: u.role,
  department: u.department,
  phone: u.phone,
  isActive: u.isActive,
  failedLoginCount: u.failedLoginCount,
  lockoutEnabled: u.lockoutEnabled,
  lockoutEnd: u.lockoutEnd,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt
});

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    const filter = {};

    if (role && role !== 'All') {
      filter.role = role;
    }
    if (status && status !== 'All') {
      filter.isActive = status === 'Active';
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { department: searchRegex }
      ];
    }

    const users = await User.find(filter)
      .select('-password -securityStamp')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users.map(toUserDTO)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -securityStamp');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: toUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user by Admin
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'Sales Executive', phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and temporary password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one letter and one number'
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address'
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    const hashedPassword = hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      userName: email.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      phone: phone ? phone.trim() : '',
      department: department ? department.trim() : 'Sales'
    });

    await logAudit({
      req,
      action: 'CREATE_USER',
      entityName: 'User',
      recordId: user._id,
      details: `Admin created user ${user.email} with role '${user.role}'`,
      result: 'SUCCESS',
      newValue: { name: user.name, email: user.email, role: user.role }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: toUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details or role
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { name, role, phone, department, isActive } = req.body;

    const oldValues = {
      name: user.name,
      role: user.role,
      department: user.department,
      isActive: user.isActive
    };

    if (name) user.name = name.trim();
    if (role) {
      const validRoles = ['Admin', 'Manager', 'Sales Executive'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
      user.role = role;
    }
    if (phone !== undefined) user.phone = phone.trim();
    if (department !== undefined) user.department = department.trim();
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();

    await logAudit({
      req,
      action: 'UPDATE_USER',
      entityName: 'User',
      recordId: user._id,
      details: `Admin updated user ${user.email} (Role: ${user.role}, Active: ${user.isActive})`,
      result: 'SUCCESS',
      oldValue: oldValues,
      newValue: {
        name: user.name,
        role: user.role,
        department: user.department,
        isActive: user.isActive
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: toUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlock user account
// @route   POST /api/users/:id/unlock
// @access  Private/Admin
const unlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.failedLoginCount = 0;
    user.lockoutEnd = null;
    await user.save();

    await logAudit({
      req,
      action: 'UNLOCK',
      entityName: 'User',
      recordId: user._id,
      details: `Admin unlocked account for ${user.email}`,
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Account for ${user.email} has been unlocked.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin reset user password
// @route   POST /api/users/:id/reset-password
// @access  Private/Admin
const adminResetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one letter and one number'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = hashPassword(newPassword);
    user.failedLoginCount = 0;
    user.lockoutEnd = null;
    await user.save();

    await logAudit({
      req,
      action: 'PASSWORD_RESET',
      entityName: 'User',
      recordId: user._id,
      details: `Admin reset password for user ${user.email}`,
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Password reset successfully for ${user.email}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user list for dropdowns (any authenticated user)
// @route   GET /api/users/assignable
// @access  Authenticated
const getAssignableUsers = async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true }).select('name email role department');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  unlockUser,
  adminResetPassword,
  getAssignableUsers
};
