import mongoose from "mongoose";

const userRoleSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },
    roleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    planSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "halfYearly", "yearly"],
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "active", "expired", "cancelled", "superseded"],
      default: "active",
      index: true,
    },
    changeType: {
      type: String,
      enum: ["new", "renewal", "plan_change", "cycle_change"],
      default: "new",
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    previousSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRoleSubscription",
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

userRoleSubscriptionSchema.index({ user: 1, role: 1, status: 1 });
userRoleSubscriptionSchema.index({ user: 1, roleRef: 1, planSlug: 1, billingCycle: 1 });
userRoleSubscriptionSchema.index({ user: 1, roleRef: 1, startsAt: 1, status: 1 });
userRoleSubscriptionSchema.index({ user: 1, roleRef: 1, expiresAt: 1, status: 1 });

const UserRoleSubscription = mongoose.model("UserRoleSubscription", userRoleSubscriptionSchema);

export default UserRoleSubscription;
