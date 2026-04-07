// ==========================================
// models/CourtSubscription.js
// Player's active subscription to a Court Subscription Plan
// ==========================================

import mongoose from 'mongoose';

const courtSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourtSubscriptionPlan',
      required: true
    },
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      required: true
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SportsAcademy',
      required: true
    },

    // Subscription period
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Selected sessions at subscribe time: [{ date, startTime, endTime }]
    selectedSessions: [{
      date: { type: String, required: true }, // YYYY-MM-DD
      startTime: { type: String, required: true },
      endTime: { type: String, required: true }
    }],

    // Sessions used / remaining (for tracking)
    sessionsUsed: { type: Number, default: 0 },
    remainingSessions: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT'],
      default: 'ACTIVE'
    },

    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PAID'
    },

    paymentDetails: {
      transactionId: String,
      paymentGateway: String,
      paidAt: Date,
      amount: Number,
      currency: { type: String, default: 'INR' }
    }
  },
  { timestamps: true }
);

courtSubscriptionSchema.index({ user: 1, status: 1 });
courtSubscriptionSchema.index({ court: 1 });
courtSubscriptionSchema.index({ plan: 1 });
courtSubscriptionSchema.index({ academy: 1 });

const CourtSubscription = mongoose.model('CourtSubscription', courtSubscriptionSchema);
export default CourtSubscription;
