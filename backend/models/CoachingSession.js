import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    status: {
      type: String,
      enum: ["enrolled", "completed", "dropped", "absent"],
      default: "enrolled",
    },
    attended: { type: Boolean, default: false },
    enrolledAt: { type: Date, default: Date.now },
    feedback: { type: String, default: "" },
    rating: { type: Number, min: 1, max: 5, default: null },
  },
  { _id: true }
);

const occurrenceHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["completed", "cancelled", "rescheduled"],
      default: "completed",
    },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const playerCheckInSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    occurrenceDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date, default: null },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: { type: String, default: "" },
  },
  { _id: true }
);

const coachingSessionSchema = new mongoose.Schema(
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
    sportName: { type: String, default: "" },

    title: {
      type: String,
      required: [true, "Session title is required"],
      trim: true,
    },
    description: { type: String, default: "", trim: true },

    type: {
      type: String,
      enum: ["one_on_one", "group", "batch"],
      default: "one_on_one",
    },
    ownerType: {
      type: String,
      enum: ["academy", "coach"],
      default: "coach",
    },
    billingScope: {
      type: String,
      enum: ["individual", "team", "batch"],
      default: "individual",
    },

    schedule: {
      date: { type: Date, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      duration: { type: Number, default: 60 },
      recurring: { type: Boolean, default: false },
      recurrencePattern: {
        type: String,
        enum: ["daily", "weekly", "biweekly", "monthly", ""],
        default: "",
      },
    },

    maxStudents: { type: Number, default: 1 },
    students: [attendeeSchema],

    pricing: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      type: {
        type: String,
        enum: ["per_session", "package", "free"],
        default: "per_session",
      },
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

    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      default: null,
    },

    location: { type: String, default: "" },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },

    notes: { type: String, default: "" },
    cancellationReason: { type: String, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      trainingPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TrainingPlan",
        default: null,
      },
      assignedTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null,
      },
      batchId: {
        type: String,
        default: "",
      },
      payoutRuleSnapshot: {
        model: {
          type: String,
          enum: ["revenue_share", "fixed_per_session", "fixed_per_player", ""],
          default: "",
        },
        value: {
          type: Number,
          default: 0,
        },
        currency: {
          type: String,
          default: "INR",
        },
      },
      payerTypeDefault: {
        type: String,
        enum: ["team", "player", ""],
        default: "",
      },
      occurrenceCycleStartDate: {
        type: Date,
        default: null,
      },
      occurrenceCycleEndDate: {
        type: Date,
        default: null,
      },
      occurrences: {
        type: [occurrenceHistorySchema],
        default: [],
      },
      playerCheckIns: {
        type: [playerCheckInSchema],
        default: [],
      },
    },
  },
  { timestamps: true }
);

coachingSessionSchema.index({ coach: 1, status: 1 });
coachingSessionSchema.index({ coach: 1, "schedule.date": 1 });
coachingSessionSchema.index({ academy: 1, coach: 1 });
coachingSessionSchema.index({ sport: 1 });
coachingSessionSchema.index({ "students.player": 1 });

const CoachingSession = mongoose.model("CoachingSession", coachingSessionSchema);

export default CoachingSession;
