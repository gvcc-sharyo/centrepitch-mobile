import mongoose from "mongoose";

const trainingPlanSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      default: null,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSport",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["one_on_one", "group", "batch"],
      default: "one_on_one",
    },
    recurrence: {
      enabled: { type: Boolean, default: false },
      pattern: {
        type: String,
        enum: ["weekly", "biweekly", "monthly", ""],
        default: "",
      },
      weekdays: [{
        type: String,
        enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      }],
    },
    scheduleTemplate: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      duration: { type: Number, default: 60 },
    },
    capacity: {
      maxStudents: { type: Number, default: 1 },
    },
    pricing: {
      type: {
        type: String,
        enum: ["free", "per_session", "package"],
        default: "free",
      },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      packageMeta: {
        billingCycle: {
          type: String,
          enum: ["monthly", ""],
          default: "",
        },
        sessionsIncluded: { type: Number, default: null },
        validityDays: { type: Number, default: null },
      },
    },
    location: {
      court: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Court",
        default: null,
      },
      label: { type: String, default: "" },
    },
    participants: {
      players: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Player",
        },
      ],
    },
    status: {
      type: String,
      enum: ["active", "paused", "archived"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

trainingPlanSchema.index({ coach: 1, status: 1, createdAt: -1 });
trainingPlanSchema.index({ coach: 1, sport: 1, type: 1 });

const TrainingPlan = mongoose.model("TrainingPlan", trainingPlanSchema);

export default TrainingPlan;
