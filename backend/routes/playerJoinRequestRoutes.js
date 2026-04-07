import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createPlayerJoinRequest,
  getMyPlayerJoinRequests,
  getAcademyPlayerJoinRequests,
  approvePlayerJoinRequest,
  rejectPlayerJoinRequest,
  removePlayerFromAcademy,
  leaveAcademy,
} from "../controllers/playerJoinRequestController.js";

const router = express.Router();

router.use(protect);

router.post("/", createPlayerJoinRequest);
router.get("/my", getMyPlayerJoinRequests);
router.get("/academy", getAcademyPlayerJoinRequests);
router.put("/remove", removePlayerFromAcademy);
router.put("/leave", leaveAcademy);
router.put("/:id/approve", approvePlayerJoinRequest);
router.put("/:id/reject", rejectPlayerJoinRequest);

export default router;
