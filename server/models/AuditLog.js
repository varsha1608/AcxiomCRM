const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userName: {
      type: String,
      default: 'System/Guest'
    },
    userRole: {
      type: String,
      default: 'Anonymous'
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    entityName: {
      type: String,
      required: true,
      trim: true
    },
    recordId: {
      type: String,
      default: ''
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    details: {
      type: String,
      default: ''
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS'
    },
    ipAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Append-only audit log
  }
);

// Prevent modifications and deletions to guarantee audit integrity
auditLogSchema.pre('updateOne', function () {
  throw new Error('Audit records are append-only and cannot be modified');
});
auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit records cannot be deleted');
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
