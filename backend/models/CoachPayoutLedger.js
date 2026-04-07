import mongoose from "mongoose";

const coachPayoutLedgerSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingSession",
      required: true,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      required: true,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    occurrenceDate: {
      type: Date,
      required: true,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    academyShare: {
      type: Number,
      default: 0,
    },
    coachShare: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    calculationBasis: {
      type: String,
      enum: ["attendance_count", "fixed"],
      default: "attendance_count",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "disputed"],
      default: "pending",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paymentRef: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

coachPayoutLedgerSchema.index({ academy: 1, status: 1, createdAt: -1 });
coachPayoutLedgerSchema.index({ coach: 1, status: 1, createdAt: -1 });
coachPayoutLedgerSchema.index({ session: 1, occurrenceDate: 1 }, { unique: true });

const CoachPayoutLedger = mongoose.model("CoachPayoutLedger", coachPayoutLedgerSchema);

export default CoachPayoutLedger;
