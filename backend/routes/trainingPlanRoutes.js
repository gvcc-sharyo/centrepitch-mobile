import express from "express";
import { protect, isCoach } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";
import {
  createTrainingPlan,
  getMyTrainingPlans,
  updateTrainingPlan,
  generatePlanOccurrences,
} from "../controllers/trainingPlanController.js";

const router = express.Router();

router.use(protect, isCoach);

router.post("/", requireActiveSubscription('coach'), createTrainingPlan);
router.get("/my", getMyTrainingPlans);
router.put("/:id", requireActiveSubscription('coach'), updateTrainingPlan);
router.post("/:id/generate-occurrences", requireActiveSubscription('coach'), generatePlanOccurrences);

export default router;
