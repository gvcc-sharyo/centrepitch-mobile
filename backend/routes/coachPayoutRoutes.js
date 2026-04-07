import express from "express";
import { protect, isAcademyAdmin, isCoach } from "../middleware/auth.js";
import {
  getAcademyMonthlyPayoutSheet,
  payAcademyMonthlyPayoutSheet,
  getAcademyCoachPayouts,
  getCoachMyPayouts,
  approveCoachPayout,
  payCoachPayout,
} from "../controllers/coachPayoutController.js";

const router = express.Router();

router.use(protect);

router.get("/academy", isAcademyAdmin, getAcademyCoachPayouts);
router.get("/academy/monthly-sheet", isAcademyAdmin, getAcademyMonthlyPayoutSheet);
router.put("/academy/monthly-sheet/pay", isAcademyAdmin, payAcademyMonthlyPayoutSheet);
router.get("/coach/my", isCoach, getCoachMyPayouts);
router.put("/:id/approve", isAcademyAdmin, approveCoachPayout);
router.put("/:id/pay", isAcademyAdmin, payCoachPayout);

export default router;
