// ==========================================
// STEP 3: CREATE models/ApprovalLog.js
// ==========================================
// This is a NEW file - Create it in your models/ folder

import mongoose from 'mongoose';

const approvalLogSchema = new mongoose.Schema(
  {
    // Entity Type - What is being approved?
    entityType: {
      type: String,
      enum: ['ACADEMY', 'COACH', 'COURT', 'TEAM', 'EVENT'],
      required: true
    },
    
    // Entity ID - Reference to the entity
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    
    // Action taken
    action: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'PENDING', 'REVOKED', 'SUSPENDED'],
      required: true
    },
    
    // Who took the action
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    // Role of the person who took action
    actionByRole: {
      type: String,
      enum: ['superadmin', 'academyadmin', 'organizer'],
      required: true
    },
    
    // Status tracking
    previousStatus: String,
    newStatus: String,
    
    // Reason for action (especially important for rejections)
    reason: String,
    
    // Additional notes
    notes: String,
    
    // Any additional metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true // This adds createdAt and updatedAt automatically
  }
);

// Indexes for performance
approvalLogSchema.index({ entityType: 1, entityId: 1 });
approvalLogSchema.index({ actionBy: 1 });
approvalLogSchema.index({ createdAt: -1 }); // For sorting by recent actions

// Static method to create a log entry
approvalLogSchema.statics.createLog = async function(data) {
  return await this.create({
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    actionBy: data.actionBy,
    actionByRole: data.actionByRole,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
    reason: data.reason,
    notes: data.notes,
    metadata: data.metadata
  });
};

// Static method to get approval history for an entity
approvalLogSchema.statics.getHistory = async function(entityType, entityId) {
  return await this.find({ entityType, entityId })
    .populate('actionBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

const ApprovalLog = mongoose.model('ApprovalLog', approvalLogSchema);

export default ApprovalLog;

// ==========================================
// INTEGRATION NOTES:
// ==========================================
// 1. Create a new file: models/ApprovalLog.js
// 2. Copy this entire code into that file
// 3. This model tracks ALL approval/rejection actions
// 4. Provides audit trail for compliance
// 5. Usage example:
//    await ApprovalLog.createLog({
//      entityType: 'ACADEMY',
//      entityId: academy._id,
//      action: 'APPROVED',
//      actionBy: req.user._id,
//      actionByRole: req.user.role,
//      previousStatus: 'PENDING',
//      newStatus: 'APPROVED',
//      notes: 'All documents verified'
//    });