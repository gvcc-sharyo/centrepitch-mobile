import express from "express";
import { protect, isCoach, isAcademyAdmin, isPlayer } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";
import {
  createSession,
  getMySessions,
  getSessionById,
  updateSession,
  deleteSession,
  markAttendance,
  requestPlayerCheckIn,
  approvePlayerCheckIn,
  rejectPlayerCheckIn,
  getCoachAttendanceSummary,
  getCoachSessionWiseAttendance,
  getCoachPlayerWiseAttendance,
  getPlayerSessions,
  getPlayerAvailableSessions,
  getAcademySessions,
  createAcademySession,
} from "../controllers/coachSessionController.js";

const router = express.Router();

router.use(protect);

// Player
router.get("/player/available", getPlayerAvailableSessions);
router.get("/player/my", getPlayerSessions);
router.post("/:id/player-checkin", isPlayer, requestPlayerCheckIn);

// Academy admin
router.get("/academy", isAcademyAdmin, getAcademySessions);
router.post("/academy", isAcademyAdmin, requireActiveSubscription('academyadmin'), createAcademySession);

// Coach
router.post("/", isCoach, requireActiveSubscription('coach'), createSession);
router.get("/my", isCoach, getMySessions);
router.get("/coach/attendance-summary", isCoach, getCoachAttendanceSummary);
router.get("/coach/attendance-by-session", isCoach, getCoachSessionWiseAttendance);
router.get("/coach/attendance-by-player", isCoach, getCoachPlayerWiseAttendance);
router.put("/:id", isCoach, requireActiveSubscription('coach'), updateSession);
router.delete("/:id", isCoach, requireActiveSubscription('coach'), deleteSession);
router.put("/:id/attendance", isCoach, requireActiveSubscription('coach'), markAttendance);
router.put("/:id/player-checkin/:playerId/approve", isCoach, requireActiveSubscription('coach'), approvePlayerCheckIn);
router.put("/:id/player-checkin/:playerId/reject", isCoach, requireActiveSubscription('coach'), rejectPlayerCheckIn);

// Shared
router.get("/:id", getSessionById);

export default router;
