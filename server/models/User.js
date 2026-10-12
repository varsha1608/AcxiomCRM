const mongoose = require('mongoose');
const crypto = require('crypto');
const { verifyPassword, hashPassword } = require('../utils/aspnetIdentityHasher');

/**
 * IdentityUser Schema
 * Models Microsoft.AspNetCore.Identity.IdentityUser<string>
 * Includes core Identity attributes, lockout policy, security stamps, and extended application profile fields.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'User name cannot exceed 100 characters']
    },
    userName: {
      type: String,
      trim: true
    },
    normalizedUserName: {
      type: String,
      trim: true,
      uppercase: true
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    normalizedEmail: {
      type: String,
      trim: true,
      uppercase: true
    },
    emailConfirmed: {
      type: Boolean,
      default: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false
    },
    securityStamp: {
      type: String,
      default: () => crypto.randomUUID(),
      select: false
    },
    concurrencyStamp: {
      type: String,
      default: () => crypto.randomUUID()
    },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Sales Executive'],
      default: 'Sales Executive'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    phoneNumberConfirmed: {
      type: Boolean,
      default: false
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    department: {
      type: String,
      trim: true,
      default: 'Sales'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    failedLoginCount: {
      type: Number,
      default: 0
    },
    lockoutEnabled: {
      type: Boolean,
      default: true
    },
    lockoutEnd: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to populate normalized Identity fields
userSchema.pre('save', function (next) {
  if (this.email) {
    this.normalizedEmail = this.email.toUpperCase();
    if (!this.userName) {
      this.userName = this.email;
    }
  }
  if (this.userName) {
    this.normalizedUserName = this.userName.toUpperCase();
  }
  if (!this.securityStamp) {
    this.securityStamp = crypto.randomUUID();
  }
  if (this.isModified() && !this.isNew) {
    this.concurrencyStamp = crypto.randomUUID();
  }
  next();
});

// Method to verify password against ASP.NET Identity V3 / bcrypt hash
userSchema.methods.matchPassword = function (enteredPassword) {
  return verifyPassword(enteredPassword, this.password);
};

// Check if account is currently locked out
userSchema.methods.isLocked = function () {
  return !!(this.lockoutEnabled && this.lockoutEnd && this.lockoutEnd > new Date());
};

const User = mongoose.model('User', userSchema);
module.exports = User;
