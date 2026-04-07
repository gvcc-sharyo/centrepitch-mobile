import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      enum: ['free', 'basic', 'premium', 'enterprise'],
    },
    // Who this plan is for
    targetRoleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    tagline: {
      type: String,
      default: '',
    },
    // Pricing
    price: {
      monthly: { type: Number, default: 0 },
      quarterly: { type: Number, default: 0 },
      halfYearly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    // Discount info (e.g. "Save 20%")
    yearlyDiscount: {
      type: Number,
      default: 0,
    },
    // Legacy shared features list (kept for backward compatibility).
    features: [
      {
        text: { type: String, required: true },
        included: { type: Boolean, default: true },
        highlight: { type: Boolean, default: false },
      },
    ],
    // Cycle-wise feature sets (primary source).
    featuresByCycle: {
      monthly: [
        {
          text: { type: String, required: true },
          included: { type: Boolean, default: true },
          highlight: { type: Boolean, default: false },
        },
      ],
      quarterly: [
        {
          text: { type: String, required: true },
          included: { type: Boolean, default: true },
          highlight: { type: Boolean, default: false },
        },
      ],
      halfYearly: [
        {
          text: { type: String, required: true },
          included: { type: Boolean, default: true },
          highlight: { type: Boolean, default: false },
        },
      ],
      yearly: [
        {
          text: { type: String, required: true },
          included: { type: Boolean, default: true },
          highlight: { type: Boolean, default: false },
        },
      ],
    },
    // Limits
    limits: {
      maxTeams: { type: Number, default: 0 },
      maxPlayers: { type: Number, default: 0 },
      maxCourts: { type: Number, default: 0 },
      maxEvents: { type: Number, default: 0 },
      maxCoaches: { type: Number, default: 0 },
      maxStorage: { type: Number, default: 0 },
      analytics: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
    },
    // Cycle-wise limits (primary source).
    limitsByCycle: {
      monthly: {
        maxTeams: { type: Number, default: 0 },
        maxPlayers: { type: Number, default: 0 },
        maxCourts: { type: Number, default: 0 },
        maxEvents: { type: Number, default: 0 },
        maxCoaches: { type: Number, default: 0 },
        maxStorage: { type: Number, default: 0 },
        analytics: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
      },
      quarterly: {
        maxTeams: { type: Number, default: 0 },
        maxPlayers: { type: Number, default: 0 },
        maxCourts: { type: Number, default: 0 },
        maxEvents: { type: Number, default: 0 },
        maxCoaches: { type: Number, default: 0 },
        maxStorage: { type: Number, default: 0 },
        analytics: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
      },
      halfYearly: {
        maxTeams: { type: Number, default: 0 },
        maxPlayers: { type: Number, default: 0 },
        maxCourts: { type: Number, default: 0 },
        maxEvents: { type: Number, default: 0 },
        maxCoaches: { type: Number, default: 0 },
        maxStorage: { type: Number, default: 0 },
        analytics: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
      },
      yearly: {
        maxTeams: { type: Number, default: 0 },
        maxPlayers: { type: Number, default: 0 },
        maxCourts: { type: Number, default: 0 },
        maxEvents: { type: Number, default: 0 },
        maxCoaches: { type: Number, default: 0 },
        maxStorage: { type: Number, default: 0 },
        analytics: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
      },
    },
    // Display
    isPopular: {
      type: Boolean,
      default: false,
    },
    badge: {
      type: String,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionPlanSchema.index({ targetRoleRef: 1, isActive: 1, sortOrder: 1 });
subscriptionPlanSchema.index({ slug: 1, targetRoleRef: 1 }, { unique: true });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

export default SubscriptionPlan;
