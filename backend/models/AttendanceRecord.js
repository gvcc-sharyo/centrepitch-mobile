import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingSession",
      required: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingEnrollment",
      default: null,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingPlan",
      default: null,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      default: null,
    },
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
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    ownerType: {
      type: String,
      enum: ["academy", "coach"],
      default: "coach",
    },
    occurrenceDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      default: "present",
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ session: 1, player: 1, occurrenceDate: 1 }, { unique: true });
attendanceRecordSchema.index({ coach: 1, createdAt: -1 });
attendanceRecordSchema.index({ player: 1, createdAt: -1 });
attendanceRecordSchema.index({ coach: 1, occurrenceDate: -1 });

const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);

export default AttendanceRecord;
