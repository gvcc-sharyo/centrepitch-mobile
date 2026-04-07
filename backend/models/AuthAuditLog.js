import mongoose from "mongoose";

const authAuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ["password", "google", "otp", "system", "unknown"],
      default: "unknown",
      index: true,
    },
    portal: {
      type: String,
      enum: ["user", "admin", "pending", "unknown"],
      default: "unknown",
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGIN_BLOCKED_ACTIVE_SESSION",
        "LOGIN_FORCE_TAKEOVER",
        "LOGOUT",
        "SESSION_INVALIDATED",
        "TOKEN_ISSUED",
      ],
      required: true,
      index: true,
    },
    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILED", "BLOCKED", "INFO"],
      default: "INFO",
      index: true,
    },
    reasonCode: {
      type: String,
      default: null,
      index: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    ipSource: {
      type: String,
      enum: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip", "req.ip", "unknown"],
      default: "unknown",
      index: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    device: {
      type: {
        type: String,
        enum: ["mobile", "tablet", "desktop", "bot", "unknown"],
        default: "unknown",
      },
      os: {
        type: String,
        default: "unknown",
      },
      browser: {
        type: String,
        default: "unknown",
      },
    },
    location: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
      timezone: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      source: {
        type: String,
        enum: ["cloudflare", "vercel", "generic", "none"],
        default: "none",
      },
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

authAuditLogSchema.index({ createdAt: -1 });
authAuditLogSchema.index({ eventType: 1, createdAt: -1 });
authAuditLogSchema.index({ user: 1, createdAt: -1 });
authAuditLogSchema.index({ email: 1, createdAt: -1 });

const AuthAuditLog = mongoose.model("AuthAuditLog", authAuditLogSchema);

export default AuthAuditLog;
