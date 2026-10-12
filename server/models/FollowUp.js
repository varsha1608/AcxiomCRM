const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    relatedType: {
      type: String,
      enum: ['Customer', 'Lead'],
      default: 'Customer'
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null
    },
    followUpDate: {
      type: Date,
      required: [true, 'Follow-up date and time are required']
    },
    followUpType: {
      type: String,
      enum: ['Call', 'Email', 'Meeting', 'Demo', 'Task'],
      default: 'Call'
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters']
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['Planned', 'Completed', 'Missed', 'Cancelled'],
      default: 'Planned'
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
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const FollowUp = mongoose.model('FollowUp', followUpSchema);
module.exports = FollowUp;
