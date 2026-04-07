import express from "express";
import { protect, isAcademyAdmin, isCoach, isPlayer } from "../middleware/auth.js";
import {
  academyMarkTeamSessionPayment,
  approveEnrollmentRequest,
  createEnrollment,
  getMyEnrollments,
  rejectEnrollmentRequest,
  updateEnrollmentPaymentStatus,
} from "../controllers/coachingEnrollmentController.js";

const router = express.Router();

router.use(protect);

router.post("/", isPlayer, createEnrollment);
router.get("/my", isPlayer, getMyEnrollments);
router.put("/:id/payment", isPlayer, updateEnrollmentPaymentStatus);
router.put("/academy/session/:sessionId/team-payment", isAcademyAdmin, academyMarkTeamSessionPayment);
router.put("/:id/approve", isCoach, approveEnrollmentRequest);
router.put("/:id/reject", isCoach, rejectEnrollmentRequest);

export default router;
