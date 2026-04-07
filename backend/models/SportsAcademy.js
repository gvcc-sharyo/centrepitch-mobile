import mongoose from "mongoose";

const sportsAcademySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Academy name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    emailOtp: {
      type: String,
      default: null,
    },
    emailOtpExpire: {
      type: Date,
      default: null,
    },
    phoneOtp: {
      type: String,
      default: null,
    },
    phoneOtpExpire: {
      type: Date,
      default: null,
    },
    website: {
      type: String,
      default: null,
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "India" },
      pincode: { type: String, default: "" },
    },
    sportsOffered: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sport',
      },
    ],
    facilities: [
      {
        type: String,
        enum: [
          "INDOOR_COURTS",
          "OUTDOOR_COURTS",
          "GYM",
          "SWIMMING_POOL",
          "CAFETERIA",
          "CHANGING_ROOMS",
          "PARKING",
          "FIRST_AID",
          "EQUIPMENT_RENTAL",
          "COACHING_STAFF",
          "MEDICAL_ROOM",
          "PHYSIOTHERAPY",
        ],
      },
    ],
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    kycStatus: {
      type: String,
      enum: ["INCOMPLETE", "PENDING", "VERIFIED", "REJECTED"],
      default: "INCOMPLETE",
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    rejectionReason: String,
    coaches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coach",
      },
    ],
    courts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Court",
      },
    ],
    totalStudents: {
      type: Number,
      default: 0,
    },
    establishedYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

sportsAcademySchema.index({ status: 1 });
sportsAcademySchema.index({ "address.city": 1 });

const SportsAcademy = mongoose.model("SportsAcademy", sportsAcademySchema);

export default SportsAcademy;
