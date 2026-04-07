import mongoose from "mongoose";

const sportAuditTrailSchema = new mongoose.Schema(
  {
    sportModel: {
      type: String,
      enum: ["Sport", "UserSport"],
      required: true,
      index: true,
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"],
      required: true,
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
  {
    timestamps: true,
  },
);

sportAuditTrailSchema.index({ sportModel: 1, sportId: 1, createdAt: -1 });
sportAuditTrailSchema.index({ ownerUser: 1, createdAt: -1 });

const SportAuditTrail = mongoose.model("SportAuditTrail", sportAuditTrailSchema);

export default SportAuditTrail;
