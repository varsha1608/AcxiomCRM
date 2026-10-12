const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
  {
    opportunityName: {
      type: String,
      required: [true, 'Opportunity name is required'],
      trim: true,
      maxlength: [120, 'Opportunity name cannot exceed 120 characters']
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Related Customer is required']
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null
    },
    amount: {
      type: Number,
      required: [true, 'Opportunity amount is required'],
      min: [0.01, 'Opportunity Amount must be greater than 0']
    },
    stage: {
      type: String,
      enum: ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'],
      default: 'Qualification'
    },
    probability: {
      type: Number,
      required: [true, 'Probability is required'],
      min: [0, 'Probability must be between 0 and 100'],
      max: [100, 'Probability must be between 0 and 100'],
      default: 20
    },
    expectedCloseDate: {
      type: Date,
      required: [true, 'Expected close date is required']
    },
    status: {
      type: String,
      enum: ['Open', 'Won', 'Lost'],
      default: 'Open'
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
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for weighted pipeline value
opportunitySchema.virtual('weightedAmount').get(function () {
  return ((this.amount || 0) * (this.probability || 0)) / 100;
});

const Opportunity = mongoose.model('Opportunity', opportunitySchema);
module.exports = Opportunity;
