// ==========================================
// models/User.js - UPDATED for Academy Integration
// ==========================================

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Player from "./Player.js";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: [6, "Password must be at least 6 characters"],
    },
    phone: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    // Role is dynamic; canonical mapping lives in Role collection via roleRef.
    role: {
      type: String,
      trim: true,
      lowercase: true,
      default: "player",
    },
    roleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    baseRole: {
      type: String,
      trim: true,
      lowercase: true,
      default: "player",
    },
    activeRole: {
      type: String,
      trim: true,
      lowercase: true,
      default: "player",
    },
    permissionRefs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    unlockedRoles: [
      {
        role: {
          type: String,
          trim: true,
          lowercase: true,
          required: true,
        },
        roleRef: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Role",
          default: null,
        },
        unlockedAt: {
          type: Date,
          default: Date.now,
        },
        sourcePlanSlug: {
          type: String,
          default: "",
          trim: true,
          lowercase: true,
        },
        billingCycle: {
          type: String,
          enum: ["monthly", "quarterly", "halfYearly", "yearly", ""],
          default: "",
        },
        unlockFlag: {
          type: Number,
          enum: [0, 1],
          default: 1,
        },
      },
    ],
    activeSessionId: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String,
    },

    // For Players
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
    },
    sportsInterests: [
      {
        type: String,
      },
    ],
    achievements: [
      {
        title: String,
        description: String,
        date: Date,
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Event",
        },
      },
    ],
    performanceStats: {
      eventsParticipated: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
    },

    // For Organizers
    organizationName: String,
    organizationLogo: String,
    /** Catalog sports this organizer runs events for (Super Admin Sport ids). Shown on player profiles when linked via event registration. */
    organizerSports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sport",
      },
    ],
    paymentStatus: {
      type: String,
      enum: ["pending", "active", "expired", "none"],
      default: "none",
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "trial", "basic", "premium", "enterprise"],
      default: "free",
    },
    subscriptionBillingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "halfYearly", "yearly"],
      default: "monthly",
    },
    subscriptionExpiry: Date,
    trialStartDate: Date,
    subscriptionPromptOpenCount: {
      type: Number,
      default: 0,
    },
    subscriptionPromptLastShownAt: Date,

    // NEW: For Academy Admins
    // Links user account to their academy
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      default: null,
    },

    // NEW: For Coaches
    // Links user account to their coach profile
    coachProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      default: null,
    },

    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // OTP Verification
    otp: String,
    otpExpire: Date,
    emailOtp: String,
    emailOtpExpire: Date,
    phoneOtp: String,
    phoneOtpExpire: Date,
  },
  {
    timestamps: true,
  },
);

// Hash password before saving (only when password field changed — never re-hash an existing hash)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.pre("validate", function (next) {
  const role = String(this.role || "player").toLowerCase();
  // Default activeRole is "player" in schema; without this, superadmin/scorer keep wrong activeRole.
  const fixedPortalRoles = new Set(["superadmin", "scorer"]);
  if (fixedPortalRoles.has(role)) {
    this.activeRole = role;
    this.baseRole = role;
  } else {
    if (!this.baseRole) this.baseRole = role;
    if (!this.activeRole) this.activeRole = role;
  }
  const entries = Array.isArray(this.unlockedRoles) ? [...this.unlockedRoles] : [];
  const hasRole = entries.some((entry) => String(entry?.role || "").toLowerCase() === role);
  if (!hasRole) {
    entries.push({
      role,
      roleRef: this.roleRef || null,
      unlockedAt: new Date(),
      sourcePlanSlug: String(this.subscriptionPlan || "").toLowerCase(),
      billingCycle: String(this.subscriptionBillingCycle || ""),
      unlockFlag: 1,
    });
  }
  this.unlockedRoles = entries.map((entry) => ({
    ...entry,
    unlockFlag: Number(entry?.unlockFlag) === 0 ? 0 : 1,
  }));
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });
// Note: email index is already created by unique: true on the email field

// Cleanup linked player profile when user is deleted via app code.
userSchema.post("findOneAndDelete", async function (doc) {
  if (!doc?._id) return;
  await Player.deleteMany({ user: doc._id });
});

userSchema.post("deleteOne", { document: true, query: false }, async function () {
  if (!this?._id) return;
  await Player.deleteMany({ user: this._id });
});

const User = mongoose.model("User", userSchema);

export default User;
