import express from "express";
import { protect, isAcademyAdmin, isCoach } from "../middleware/auth.js";
import {
  createJoinRequest,
  getMyJoinRequests,
  getAcademyJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "../controllers/joinRequestController.js";

const router = express.Router();

router.post("/", protect, isCoach, createJoinRequest);
router.get("/my", protect, isCoach, getMyJoinRequests);
router.get("/academy", protect, isAcademyAdmin, getAcademyJoinRequests);
router.put("/:id/approve", protect, isAcademyAdmin, approveJoinRequest);
router.put("/:id/reject", protect, isAcademyAdmin, rejectJoinRequest);

export default router;
