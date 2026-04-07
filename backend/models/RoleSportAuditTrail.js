import mongoose from "mongoose";

const roleSportAuditTrailSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["USER", "ACADEMY", "PLAYER"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["SET", "ADD", "REMOVE", "CLEAR", "UPDATE"],
      default: "UPDATE",
      index: true,
    },
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: null,
      index: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

roleSportAuditTrailSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
roleSportAuditTrailSchema.index({ actorUser: 1, createdAt: -1 });
roleSportAuditTrailSchema.index({ field: 1, createdAt: -1 });

const RoleSportAuditTrail = mongoose.model("RoleSportAuditTrail", roleSportAuditTrailSchema);

export default RoleSportAuditTrail;

