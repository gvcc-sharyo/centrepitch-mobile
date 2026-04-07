import express from "express";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../controllers/academyRoleController.js";
import { protect, isAcademyAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, isAcademyAdmin);

router.get("/", getRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
