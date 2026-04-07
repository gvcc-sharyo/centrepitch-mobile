import mongoose from "mongoose";

const academyApprovalLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["ACADEMY"],
      default: "ACADEMY",
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
  { timestamps: true, collection: "academy_approval_logs" }
);

academyApprovalLogSchema.index({ entityId: 1, createdAt: -1 });

const AcademyApprovalLog = mongoose.model("AcademyApprovalLog", academyApprovalLogSchema);
export default AcademyApprovalLog;

