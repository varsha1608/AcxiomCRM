const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { hashPassword } = require('../utils/aspnetIdentityHasher');
const { logAudit } = require('../utils/auditLogger');

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in environment');
  }
  const payload = typeof user === 'object' && user._id ? {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department
  } : { id: user };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// DTO mapper ensuring no internal password hashes, stamps, or secrets leak to the client
const toUserDTO = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  userName: user.userName || user.email,
  email: user.email,
  role: user.role,
  department: user.department,
  phone: user.phone,
  isActive: user.isActive,
  emailConfirmed: user.emailConfirmed,
  lockoutEnabled: user.lockoutEnabled
});

// @desc    Register a new user (conforming to Identity specification)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Password policy: minimum 8 chars, at least 1 letter, at least 1 number
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

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    // Hash password using ASP.NET Core Identity PasswordHasher specification
    const hashedPassword = hashPassword(password);

    // Security Fix: Never accept Admin or Manager from public registration
    // Always assign least-privileged 'Sales Executive' (unless initial system bootstrap)
    const userCount = await User.countDocuments();
    const assignedRole = userCount === 0 ? 'Admin' : 'Sales Executive';

    const user = await User.create({
      name: name.trim(),
      userName: email.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: assignedRole,
      phone: phone ? phone.trim() : '',
      department: department ? department.trim() : 'Sales'
    });

    const token = generateToken(user);

    // Set ASP.NET Core Identity authentication cookie for browser session support
    res.cookie('.AspNetCore.Identity.Application', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAudit({
      req,
      user,
      action: 'REGISTER',
      entityName: 'User',
      recordId: user._id,
      details: `New user registration for ${user.email} with role ${user.role}`,
      result: 'SUCCESS',
      newValue: { name: user.name, email: user.email, role: user.role }
    });

    res.status(201).json({
      success: true,
      token,
      user: toUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      await logAudit({
        req,
        action: 'FAILED_LOGIN',
        entityName: 'Auth',
        details: `Login attempt failed for non-existent email: ${email}`,
        result: 'FAILED'
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check account lockout
    if (user.isLocked()) {
      const waitMinutes = Math.ceil((user.lockoutEnd - new Date()) / (1000 * 60));
      await logAudit({
        req,
        user,
        action: 'LOCKED_LOGIN_ATTEMPT',
        entityName: 'Auth',
        recordId: user._id,
        details: `Login attempt on locked account: ${user.email}`,
        result: 'FAILED'
      });
      return res.status(403).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${waitMinutes} minute(s).`
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    const isMatch = user.matchPassword(password);

    if (!isMatch) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      const maxAttempts = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10);
      const lockoutMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10);

      if (user.failedLoginCount >= maxAttempts) {
        user.lockoutEnd = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        await user.save();

        await logAudit({
          req,
          user,
          action: 'LOCKOUT',
          entityName: 'Auth',
          recordId: user._id,
          details: `Account locked for ${lockoutMinutes} minutes due to ${user.failedLoginCount} failed attempts`,
          result: 'FAILED'
        });

        return res.status(403).json({
          success: false,
          message: `Account is now locked for ${lockoutMinutes} minutes due to ${user.failedLoginCount} consecutive failed login attempts.`
        });
      }

      await user.save();

      await logAudit({
        req,
        user,
        action: 'FAILED_LOGIN',
        entityName: 'Auth',
        recordId: user._id,
        details: `Incorrect password entered for ${user.email}. Attempt ${user.failedLoginCount} of ${maxAttempts}`,
        result: 'FAILED'
      });

      return res.status(401).json({
        success: false,
        message: `Invalid email or password. Attempt ${user.failedLoginCount} of ${maxAttempts} before account lockout.`
      });
    }

    // Successful login: reset failed login count & lockout
    user.failedLoginCount = 0;
    user.lockoutEnd = null;
    await user.save();

    const token = generateToken(user);

    // Set ASP.NET Core Identity authentication cookie
    res.cookie('.AspNetCore.Identity.Application', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAudit({
      req,
      user,
      action: 'LOGIN',
      entityName: 'Auth',
      recordId: user._id,
      details: `User ${user.email} successfully logged in as ${user.role}`,
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      token,
      user: toUserDTO(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Authenticated
const logoutUser = async (req, res, next) => {
  try {
    if (req.user) {
      await logAudit({
        req,
        action: 'LOGOUT',
        entityName: 'Auth',
        recordId: req.user._id,
        details: `User ${req.user.email} logged out safely`,
        result: 'SUCCESS'
      });
    }

    res.clearCookie('.AspNetCore.Identity.Application');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Authenticated
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: toUserDTO(req.user)
  });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  toUserDTO
};
