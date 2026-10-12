const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    leadCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true
    },
    leadName: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
      maxlength: [100, 'Lead name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please enter a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [
        /^[0-9+() -]{7,20}$/,
        'Please enter a valid phone number (7-20 digits)'
      ]
    },
    companyName: {
      type: String,
      trim: true,
      default: ''
    },
    source: {
      type: String,
      enum: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Partner', 'Exhibition', 'Other'],
      default: 'Website'
    },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'],
      default: 'New'
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    expectedValue: {
      type: Number,
      min: [0, 'Expected value cannot be negative'],
      default: 0
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    convertedCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    convertedOpportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

leadSchema.pre('save', async function (next) {
  if (!this.leadCode) {
    const count = await mongoose.model('Lead').countDocuments();
    this.leadCode = `LEAD-${1000 + count + 1}`;
  }
  next();
});

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
