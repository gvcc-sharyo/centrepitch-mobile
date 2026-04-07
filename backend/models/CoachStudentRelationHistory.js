import mongoose from "mongoose";

const coachStudentRelationHistorySchema = new mongoose.Schema(
  {
    relation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachStudentRelation",
      required: true,
      index: true,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
      index: true,
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
      index: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSport",
      default: null,
      index: true,
    },
    previousStatus: {
      type: String,
      enum: ["pending", "active", "inactive", "rejected", ""],
      default: "",
    },
    newStatus: {
      type: String,
      enum: ["pending", "active", "inactive", "rejected", ""],
      default: "",
    },
    action: {
      type: String,
      enum: [
        "REQUEST_SUBMITTED",
        "INVITE_SENT",
        "APPROVED_BY_COACH",
        "REJECTED_BY_COACH",
        "INVITE_ACCEPTED_BY_PLAYER",
        "INVITE_REJECTED_BY_PLAYER",
        "REMOVED_BY_COACH",
        "LEFT_BY_PLAYER",
        "ASSIGNED_BY_ACADEMY",
      ],
      required: true,
      index: true,
    },
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: "",
      index: true,
    },
    source: {
      type: String,
      enum: ["player_request", "coach_invite", "academy_assigned", "system", ""],
      default: "",
      index: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

coachStudentRelationHistorySchema.index({ createdAt: -1 });
coachStudentRelationHistorySchema.index({ coach: 1, createdAt: -1 });
coachStudentRelationHistorySchema.index({ player: 1, createdAt: -1 });
coachStudentRelationHistorySchema.index({ relation: 1, createdAt: -1 });

const CoachStudentRelationHistory = mongoose.model(
  "CoachStudentRelationHistory",
  coachStudentRelationHistorySchema
);

export default CoachStudentRelationHistory;

