import mongoose from "mongoose";

const coachingEnrollmentSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingSession",
      required: true,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      default: null,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSport",
      required: true,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "PENDING_PAYMENT", "ACTIVE", "CANCELLED_BY_PLAYER", "REJECTED_BY_COACH", "COMPLETED"],
      default: "REQUESTED",
    },
    ownerType: {
      type: String,
      enum: ["academy", "coach"],
      default: "coach",
    },
    payerType: {
      type: String,
      enum: ["player", "team", "academy_sponsored"],
      default: "player",
    },
    payerRef: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    approvedByRole: {
      type: String,
      enum: ["coach", "academy_admin", "system", ""],
      default: "",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
      default: "PENDING",
    },
    pricingSnapshot: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      type: {
        type: String,
        enum: ["per_session", "package", "free"],
        default: "per_session",
      },
    },
    paymentMethod: {
      type: String,
      enum: ["CARD", "UPI", "NET_BANKING", "WALLET", "CASH", "OTHER"],
    },
    paymentDetails: {
      transactionId: { type: String, default: "" },
      paymentGateway: { type: String, default: "" },
      paidAt: Date,
      paymentResponse: mongoose.Schema.Types.Mixed,
    },
    isTrial: {
      type: Boolean,
      default: false,
    },
    trialStartedAt: Date,
    trialEndsAt: Date,
    trialUsed: {
      type: Boolean,
      default: false,
    },
    cancellation: {
      cancelledAt: Date,
      reason: { type: String, default: "" },
      refundAmount: { type: Number, default: 0 },
      refundStatus: {
        type: String,
        enum: ["PENDING", "PROCESSED", "FAILED", "NOT_APPLICABLE"],
        default: "NOT_APPLICABLE",
      },
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

coachingEnrollmentSchema.index({ user: 1, createdAt: -1 });
coachingEnrollmentSchema.index({ player: 1, session: 1 });
coachingEnrollmentSchema.index({ session: 1, status: 1 });
coachingEnrollmentSchema.index({ paymentStatus: 1, status: 1 });

const CoachingEnrollment = mongoose.model("CoachingEnrollment", coachingEnrollmentSchema);

export default CoachingEnrollment;
