import mongoose from "mongoose";

const authSessionHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      enum: ["password", "google", "otp", "unknown"],
      default: "unknown",
      index: true,
    },
    portal: {
      type: String,
      enum: ["user", "admin", "pending", "unknown"],
      default: "unknown",
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
      index: true,
    },
    endedReason: {
      type: String,
      enum: ["LOGOUT", "FORCE_TAKEOVER", "TOKEN_REPLACED", "UNKNOWN", null],
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
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

authSessionHistorySchema.index({ user: 1, startedAt: -1 });
authSessionHistorySchema.index({ sessionId: 1 }, { unique: true });
authSessionHistorySchema.index({ isActive: 1, startedAt: -1 });

const AuthSessionHistory = mongoose.model("AuthSessionHistory", authSessionHistorySchema);

export default AuthSessionHistory;
