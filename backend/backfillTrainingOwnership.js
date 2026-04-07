import dotenv from "dotenv";
import mongoose from "mongoose";
import CoachingSession from "./models/CoachingSession.js";
import CoachingEnrollment from "./models/CoachingEnrollment.js";
import AttendanceRecord from "./models/AttendanceRecord.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/sports_event_management";
if (!mongoUri) {
  console.error("MONGODB_URI (or MONGO_URI) is required in environment variables.");
  process.exit(1);
}

const deriveBillingScopeFromSession = (session) => {
  if (session?.metadata?.assignedTeamId) return "team";
  if (session?.type === "group" || session?.type === "batch") return "batch";
  return "individual";
};

const run = async () => {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  let sessionsUpdated = 0;
  const sessions = await CoachingSession.find({
    $or: [
      { ownerType: { $exists: false } },
      { billingScope: { $exists: false } },
      { ownerType: null },
      { billingScope: null },
      { ownerType: "" },
      { billingScope: "" },
    ],
  }).select("_id academy ownerType billingScope type metadata.assignedTeamId");

  for (const session of sessions) {
    const ownerType = session?.academy ? "academy" : "coach";
    const billingScope = deriveBillingScopeFromSession(session);
    let dirty = false;

    if (!session.ownerType || !["academy", "coach"].includes(String(session.ownerType))) {
      session.ownerType = ownerType;
      dirty = true;
    }
    if (!session.billingScope || !["individual", "team", "batch"].includes(String(session.billingScope))) {
      session.billingScope = billingScope;
      dirty = true;
    }

    if (dirty) {
      await session.save();
      sessionsUpdated += 1;
    }
  }

  let enrollmentsUpdated = 0;
  const enrollments = await CoachingEnrollment.find({
    $or: [
      { ownerType: { $exists: false } },
      { payerType: { $exists: false } },
      { academy: { $exists: false } },
      { ownerType: null },
      { payerType: null },
    ],
  }).select("_id session ownerType payerType academy payerRef");

  for (const enrollment of enrollments) {
    const session = await CoachingSession.findById(enrollment.session).select("_id academy ownerType metadata.assignedTeamId");
    if (!session) continue;
    let dirty = false;

    const ownerType = session.ownerType || (session.academy ? "academy" : "coach");
    if (!enrollment.ownerType) {
      enrollment.ownerType = ownerType;
      dirty = true;
    }
    if (!enrollment.academy && session.academy) {
      enrollment.academy = session.academy;
      dirty = true;
    }
    if (!enrollment.payerType) {
      if (session?.metadata?.assignedTeamId) {
        enrollment.payerType = "team";
        enrollment.payerRef = enrollment.payerRef || session.metadata.assignedTeamId;
      } else {
        enrollment.payerType = "player";
      }
      dirty = true;
    }

    if (dirty) {
      await enrollment.save();
      enrollmentsUpdated += 1;
    }
  }

  let attendanceUpdated = 0;
  const records = await AttendanceRecord.find({
    $or: [
      { ownerType: { $exists: false } },
      { academy: { $exists: false } },
      { team: { $exists: false } },
      { enrollment: { $exists: false } },
      { ownerType: null },
    ],
  }).select("_id session player ownerType academy team enrollment");

  for (const record of records) {
    const session = await CoachingSession.findById(record.session).select("_id academy ownerType metadata.assignedTeamId");
    if (!session) continue;
    let dirty = false;

    if (!record.ownerType) {
      record.ownerType = session.ownerType || (session.academy ? "academy" : "coach");
      dirty = true;
    }
    if (!record.academy && session.academy) {
      record.academy = session.academy;
      dirty = true;
    }
    if (!record.team && session?.metadata?.assignedTeamId) {
      record.team = session.metadata.assignedTeamId;
      dirty = true;
    }
    if (!record.enrollment) {
      const enrollment = await CoachingEnrollment.findOne({
        session: record.session,
        player: record.player,
      })
        .sort({ createdAt: -1 })
        .select("_id");
      if (enrollment?._id) {
        record.enrollment = enrollment._id;
        dirty = true;
      }
    }

    if (dirty) {
      await record.save();
      attendanceUpdated += 1;
    }
  }

  console.log("Backfill completed:");
  console.log(`- Sessions updated: ${sessionsUpdated}`);
  console.log(`- Enrollments updated: ${enrollmentsUpdated}`);
  console.log(`- Attendance records updated: ${attendanceUpdated}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
