const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    activityType: {
      type: String,
      enum: ['Call', 'Meeting', 'Email', 'Task'],
      required: [true, 'Activity type is required'],
      default: 'Call'
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    activityDate: {
      type: Date,
      default: Date.now
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
    status: {
      type: String,
      enum: ['Planned', 'Completed'],
      default: 'Completed'
    }
  },
  {
    timestamps: true
  }
);

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
