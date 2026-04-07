import express from "express";
import { protect, isCoach, isAcademyAdmin } from "../middleware/auth.js";
import {
  requestTraining,
  getMyCoachRelations,
  leaveCoach,
  acceptCoachInvite,
  rejectCoachInvite,
  getMyStudents,
  approveStudent,
  rejectStudent,
  invitePlayer,
  removeStudent,
  academyAssign,
  getAcademyRelations,
  searchPlayersForInvite,
  getCoachCourts,
} from "../controllers/coachStudentController.js";

const router = express.Router();

router.use(protect);

// Player
router.post("/request", requestTraining);
router.get("/player/my", getMyCoachRelations);
router.put("/:id/accept-invite", acceptCoachInvite);
router.put("/:id/reject-invite", rejectCoachInvite);
router.put("/:id/leave", leaveCoach);

// Academy admin
router.post("/academy/assign", isAcademyAdmin, academyAssign);
router.get("/academy", isAcademyAdmin, getAcademyRelations);

// Coach helper endpoints (before /:id routes)
router.get("/search-players", isCoach, searchPlayersForInvite);
router.get("/my-courts", isCoach, getCoachCourts);

// Coach
router.get("/my", isCoach, getMyStudents);
router.post("/invite", isCoach, invitePlayer);
router.put("/:id/approve", isCoach, approveStudent);
router.put("/:id/reject", isCoach, rejectStudent);
router.put("/:id/remove", isCoach, removeStudent);

export default router;
