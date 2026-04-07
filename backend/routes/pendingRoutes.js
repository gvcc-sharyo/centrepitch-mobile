import express from "express";
import { submitPendingKyc, getPendingStatus } from "../controllers/pendingKycController.js";
import { protectPending } from "../middleware/auth.js";
import { uploadPendingKycFiles, handleUploadError } from "../middleware/upload.js";

const router = express.Router();

router.get("/status", protectPending, getPendingStatus);
router.post("/kyc", protectPending, uploadPendingKycFiles, handleUploadError, submitPendingKyc);

export default router;
