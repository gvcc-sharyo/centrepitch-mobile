import express from "express";
import {
  registerAcademy,
  getPublicAcademies,
  getPendingAcademies,
  getAllAcademiesAdmin,
  approveAcademy,
  rejectAcademy,
  deactivateAcademy,
  reactivateAcademy,
  getAcademyById,
  getPublicAcademyById,
  getMyAcademy,
  updateAcademy,
  deleteAcademy,
  updateAcademyLogo,
  getMyAcademySports,
  updateMyAcademySports,
  sendAcademyEmailOTP,
  verifyAcademyEmailOTP,
  sendAcademyPhoneOTP,
  verifyAcademyPhoneOTP,
} from "../controllers/academyController/index.js";
import { uploadAcademyFiles, uploadLogo, handleUploadError } from "../middleware/upload.js";
import { protect, isSuperAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", uploadAcademyFiles, handleUploadError, registerAcademy);
router.get("/public", getPublicAcademies);
router.get("/public/:id", getPublicAcademyById);

// Academy admin routes (must be ABOVE /:id)
router.get("/my", protect, getMyAcademy);
router.get("/my/sports", protect, getMyAcademySports);
router.put("/my/sports", protect, updateMyAcademySports);
router.post("/my/send-email-otp", protect, sendAcademyEmailOTP);
router.post("/my/verify-email-otp", protect, verifyAcademyEmailOTP);
router.post("/my/send-phone-otp", protect, sendAcademyPhoneOTP);
router.post("/my/verify-phone-otp", protect, verifyAcademyPhoneOTP);

// Super Admin routes (must be ABOVE /:id)
router.get("/admin/all", protect, isSuperAdmin, getAllAcademiesAdmin);
router.get("/pending", protect, isSuperAdmin, getPendingAcademies);
router.put("/:id/approve", protect, isSuperAdmin, approveAcademy);
router.put("/:id/reject", protect, isSuperAdmin, rejectAcademy);
router.put("/:id/deactivate", protect, isSuperAdmin, deactivateAcademy);
router.put("/:id/reactivate", protect, isSuperAdmin, reactivateAcademy);

// Protected CRUD routes
router.put("/:id/logo", protect, uploadLogo, handleUploadError, updateAcademyLogo);
router.put("/:id", protect, updateAcademy);
router.delete("/:id", protect, isSuperAdmin, deleteAcademy);

// Dynamic param route (must be LAST)
router.get("/:id", getAcademyById);

export default router;