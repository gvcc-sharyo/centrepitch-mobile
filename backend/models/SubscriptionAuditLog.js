import mongoose from "mongoose";

const subscriptionAuditLogSchema = new mongoose.Schema(
  {
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: "",
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "SUBSCRIPTION_REQUIRED_BLOCK",
        "SUBSCRIPTION_PLAN_NOT_FOUND",
        "LIMIT_CHECK_ALLOWED",
        "LIMIT_CHECK_BLOCKED",
        "SCOPE_NOT_FOUND",
        "BYPASS_SUPERADMIN",
      ],
      required: true,
      index: true,
    },
    limitKey: {
      type: String,
      enum: ["maxTeams", "maxPlayers", "maxCourts", "maxEvents", ""],
      default: "",
      index: true,
    },
    planSlug: {
      type: String,
      default: "",
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "halfYearly", "yearly", ""],
      default: "",
      index: true,
    },
    allowedLimit: {
      type: Number,
      default: 0,
    },
    currentUsage: {
      type: Number,
      default: 0,
    },
    attemptedIncrement: {
      type: Number,
      default: 0,
    },
    decision: {
      type: String,
      enum: ["ALLOWED", "BLOCKED", "INFO"],
      default: "INFO",
      index: true,
    },
    reasonCode: {
      type: String,
      default: "",
      index: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

subscriptionAuditLogSchema.index({ createdAt: -1 });
subscriptionAuditLogSchema.index({ actorUser: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ eventType: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ limitKey: 1, createdAt: -1 });

const SubscriptionAuditLog = mongoose.model("SubscriptionAuditLog", subscriptionAuditLogSchema);

export default SubscriptionAuditLog;

