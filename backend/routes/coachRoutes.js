// ==========================================
// routes/coachRoutes.js
// Coach Routes
// ==========================================

import express from 'express';

// Import from split controller files
import { registerCoach } from '../controllers/coachController/registerCoach.js';
import { getPublicCoaches } from '../controllers/coachController/getPublicCoaches.js';
import { getPublicCoachById } from '../controllers/coachController/getPublicCoachById.js';
import { getPublicCoachPlayerView } from '../controllers/coachController/getPublicCoachPlayerView.js';
import { getAllCoaches } from '../controllers/coachController/getAllCoaches.js';
import { getPendingCoaches } from '../controllers/coachController/getPendingCoaches.js';
import { approveCoachBySuperAdmin } from '../controllers/coachController/approveCoachBySuperAdmin.js';
import { rejectCoach } from '../controllers/coachController/rejectCoach.js';
import { deactivateCoach } from '../controllers/coachController/deactivateCoach.js';
import { reactivateCoach } from '../controllers/coachController/reactivateCoach.js';
import { getCoachesByAcademy } from '../controllers/coachController/getCoachesByAcademy.js';
import { approveCoachByAcademy } from '../controllers/coachController/approveCoachByAcademy.js';
import { approveCoachInAcademy, rejectCoachInAcademy, removeCoachFromAcademy, reactivateCoachInAcademy } from '../controllers/coachController/academyCoachStatus.js';
import { getMyProfile } from '../controllers/coachController/getMyProfile.js';
import { updateCoach } from '../controllers/coachController/updateCoach.js';
import { getCoachById } from '../controllers/coachController/getCoachById.js';
import { uploadKYCDocuments } from '../controllers/coachController/uploadKYCDocuments.js';
import { deleteCoach } from '../controllers/coachController/deleteCoach.js';

// Middleware imports
import {
  protect,
  isSuperAdmin,
  isCoach,
  isPlayer,
  isAcademyAdmin,
  verifyCoachAccess,
  canApproveCoach
} from '../middleware/auth.js';
import { uploadCoachFiles, uploadKycDocuments, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Register new coach (with file uploads)
router.post('/register', uploadCoachFiles, handleUploadError, registerCoach);

// Get all approved coaches
router.get('/public', getPublicCoaches);

// Get player-view coach details (public coach + player specific stats)
router.get('/public/:id/player-view', protect, isPlayer, getPublicCoachPlayerView);

// Get single coach details
router.get('/public/:id', getPublicCoachById);

// ==========================================
// SUPER ADMIN ROUTES
// ==========================================

// Get all coaches
router.get('/', protect, isSuperAdmin, getAllCoaches);

// Get pending coaches
router.get('/pending', protect, isSuperAdmin, getPendingCoaches);

// Approve coach (super admin)
router.put('/:id/approve-admin', protect, isSuperAdmin, approveCoachBySuperAdmin);

// Reject coach
router.put('/:id/reject', protect, isSuperAdmin, rejectCoach);

// Deactivate coach
router.put('/:id/deactivate', protect, isSuperAdmin, deactivateCoach);

// Reactivate coach
router.put('/:id/reactivate', protect, isSuperAdmin, reactivateCoach);

// Delete coach
router.delete('/:id', protect, isSuperAdmin, deleteCoach);

// ==========================================
// ACADEMY ADMIN ROUTES
// ==========================================

// Get coaches by academy
router.get('/academy/:academyId', protect, isAcademyAdmin, getCoachesByAcademy);

// Approve coach (academy admin)
router.put('/:id/approve-academy', protect, canApproveCoach, approveCoachByAcademy);

// Approve coach in academy (academy admin — for join requests)
router.put('/:id/approve-in-academy', protect, isAcademyAdmin, approveCoachInAcademy);

// Reject coach in academy (academy admin — for join requests)
router.put('/:id/reject-in-academy', protect, isAcademyAdmin, rejectCoachInAcademy);

// Remove coach from academy (academy admin)
router.put('/:id/remove-from-academy', protect, isAcademyAdmin, removeCoachFromAcademy);

// Reactivate coach in academy (academy admin)
router.put('/:id/reactivate-in-academy', protect, isAcademyAdmin, reactivateCoachInAcademy);

// ==========================================
// COACH ROUTES
// ==========================================

// Get my profile
router.get('/my', protect, isCoach, getMyProfile);
router.get('/me', protect, isCoach, getMyProfile);

// Update coach profile
router.put('/:id', protect, verifyCoachAccess, updateCoach);

// Upload KYC documents
router.post('/:id/kyc', protect, verifyCoachAccess, uploadKycDocuments, handleUploadError, uploadKYCDocuments);

// ==========================================
// SHARED ROUTES
// ==========================================

// Get coach by ID
router.get('/:id', protect, getCoachById);

export default router;