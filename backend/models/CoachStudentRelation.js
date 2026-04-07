import mongoose from "mongoose";

const coachStudentRelationSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSport",
      required: true,
    },
    sportName: { type: String, default: "" },

    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "active", "inactive", "rejected"],
      default: "pending",
    },

    source: {
      type: String,
      enum: ["player_request", "coach_invite", "academy_assigned"],
      default: "player_request",
    },

    message: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },

    sessionsCompleted: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    lastSessionAt: { type: Date, default: null },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

coachStudentRelationSchema.index({ coach: 1, status: 1 });
coachStudentRelationSchema.index({ player: 1, status: 1 });
coachStudentRelationSchema.index({ coach: 1, player: 1, sport: 1 }, { unique: true });
coachStudentRelationSchema.index({ academy: 1 });

const CoachStudentRelation = mongoose.model(
  "CoachStudentRelation",
  coachStudentRelationSchema
);

export default CoachStudentRelation;
