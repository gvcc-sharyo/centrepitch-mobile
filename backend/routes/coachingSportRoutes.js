import express from "express";
import {
  getCoachingSportsList,
  createPublicCoachingSport,
  updateOwnCoachingSport,
  deleteOwnCoachingSport,
} from "../controllers/userSportController.js";
import { protect, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/list", optionalAuth, getCoachingSportsList);
router.post("/public", protect, createPublicCoachingSport);
router.put("/public/:id", protect, updateOwnCoachingSport);
router.delete("/public/:id", protect, deleteOwnCoachingSport);

export default router;
