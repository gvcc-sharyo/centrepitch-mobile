import mongoose from "mongoose";

const coachApprovalLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["COACH"],
      default: "COACH",
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: {
      type: String,
      enum: ["APPROVED", "REJECTED", "PENDING", "REVOKED", "SUSPENDED"],
      required: true,
    },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionByRole: {
      type: String,
      enum: ["superadmin", "academyadmin", "organizer"],
      required: true,
    },
    previousStatus: String,
    newStatus: String,
    reason: String,
    notes: String,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true, collection: "coach_approval_logs" }
);

coachApprovalLogSchema.index({ entityId: 1, createdAt: -1 });

const CoachApprovalLog = mongoose.model("CoachApprovalLog", coachApprovalLogSchema);
export default CoachApprovalLog;

