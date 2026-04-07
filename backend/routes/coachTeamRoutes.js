import express from "express";
import { protect, isCoach, isPlayer } from "../middleware/auth.js";
import { requireActiveSubscription, enforceTeamCreationLimit } from "../middleware/subscription.js";
import {
  createTeam,
  getMyTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  updateTeamMember,
  getAvailablePlayers,
  getPlayerTeamInvites,
  respondToTeamInvite,
  getMyCoachTeamsForPlayer,
  leaveCoachTeamAsPlayer,
  invitePlayerByEmail,
} from "../controllers/coachTeamController.js";

const router = express.Router();

router.use(protect);

// Player invite endpoints
router.get("/player/invites", isPlayer, getPlayerTeamInvites);
router.get("/player/my", isPlayer, getMyCoachTeamsForPlayer);
router.put("/:id/respond", isPlayer, respondToTeamInvite);
router.put("/:id/leave", isPlayer, leaveCoachTeamAsPlayer);

router.post("/", isCoach, requireActiveSubscription('coach'), enforceTeamCreationLimit(), createTeam);
router.get("/my", isCoach, getMyTeams);
router.get("/:id", getTeamById);
router.put("/:id", isCoach, updateTeam);
router.delete("/:id", isCoach, deleteTeam);
router.put("/:id/add-player", addPlayerToTeam);
router.post("/:id/invite-email", invitePlayerByEmail);
router.put("/:id/remove-player", removePlayerFromTeam);
router.put("/:id/update-member", updateTeamMember);
router.get("/:id/available-players", isCoach, getAvailablePlayers);

export default router;
