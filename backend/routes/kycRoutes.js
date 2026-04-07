import express from "express";
import {
  submitKycDocuments,
  getMyKycStatus,
  getPendingKyc,
  getKycById,
  verifyKycDocument,
  rejectKycDocument,
  verifyAllKycDocuments,
} from "../controllers/kycController.js";
import { protect, isSuperAdmin, isAcademyAdmin } from "../middleware/auth.js";
import { uploadKycDocuments, handleUploadError } from "../middleware/upload.js";

const router = express.Router();

// ========================================
// Academy Admin routes
// ========================================

// Submit KYC documents for an academy
router.post(
  "/academy/:academyId/submit",
  protect,
  isAcademyAdmin,
  uploadKycDocuments,
  handleUploadError,
  submitKycDocuments,
);

// Get own KYC status
router.get(
  "/academy/:academyId/status",
  protect,
  isAcademyAdmin,
  getMyKycStatus,
);

// ========================================
// Super Admin routes
// ========================================

// Get all pending KYC submissions
router.get("/pending", protect, isSuperAdmin, getPendingKyc);

// Get specific KYC details
router.get("/:id", protect, isSuperAdmin, getKycById);

// Verify all documents in a KYC at once
router.put("/:id/verify-all", protect, isSuperAdmin, verifyAllKycDocuments);

// Verify a single document
router.put(
  "/:id/documents/:documentId/verify",
  protect,
  isSuperAdmin,
  verifyKycDocument,
);

// Reject a single document
router.put(
  "/:id/documents/:documentId/reject",
  protect,
  isSuperAdmin,
  rejectKycDocument,
);

export default router;
