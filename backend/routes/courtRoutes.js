// ==========================================
// routes/courtRoutes.js
// Court Routes
// ==========================================

import express from 'express';
import {
  getPublicCourts,
  getPublicCourtById,
  createCourt,
  bulkCreateCourts,
  getCourtsByAcademy,
  getMyCourts,
  updateCourt,
  submitCourtForApproval,
  uploadKYCDocuments,
  getAllCourts,
  getPendingCourts,
  approveCourt,
  rejectCourt,
  deleteCourt,
  getCourtById,
  getCourtAuditHistory,
  setCourtMaintenance,
  setCourtLive,
  toggleCourtPublish
} from '../controllers/courtController.js';

import {
  protect,
  isSuperAdmin,
  isAcademyAdmin,
  canApproveCourt
} from '../middleware/auth.js';
import { requireActiveSubscription, enforceCourtCreationLimit } from '../middleware/subscription.js';

import { uploadCourtImages, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get all approved courts
router.get('/public', getPublicCourts);

// Get single court details
router.get('/public/:id', getPublicCourtById);

// ==========================================
// SUPER ADMIN ROUTES
// ==========================================

// Get all courts
router.get('/', protect, isSuperAdmin, getAllCourts);

// Get pending courts
router.get('/pending', protect, isSuperAdmin, getPendingCourts);

// Approve court
router.put('/:id/approve', protect, canApproveCourt, approveCourt);

// Reject court
router.put('/:id/reject', protect, isSuperAdmin, rejectCourt);

// Delete court
router.delete('/:id', protect, isSuperAdmin, deleteCourt);

// ==========================================
// ACADEMY ADMIN ROUTES
// ==========================================

// Create new court
router.post('/', protect, isAcademyAdmin, requireActiveSubscription('academyadmin'), enforceCourtCreationLimit(), createCourt);

// Bulk create courts with images
router.post('/bulk', protect, isAcademyAdmin, requireActiveSubscription('academyadmin'), enforceCourtCreationLimit({ bulk: true }), uploadCourtImages, handleUploadError, bulkCreateCourts);

// Get my courts
router.get('/my', protect, isAcademyAdmin, getMyCourts);

// Get courts by academy
router.get('/academy/:academyId', protect, isAcademyAdmin, getCourtsByAcademy);

// Update court
router.put('/:id', protect, isAcademyAdmin, updateCourt);

// Legacy submit endpoint: now publishes directly under subscription validation
router.put('/:id/submit', protect, isAcademyAdmin, requireActiveSubscription('academyadmin'), submitCourtForApproval);

// Maintenance toggle (APPROVED <-> MAINTENANCE)
router.put('/:id/maintenance', protect, isAcademyAdmin, setCourtMaintenance);
router.put('/:id/go-live', protect, isAcademyAdmin, setCourtLive);

// Publish toggle (DRAFT <-> APPROVED) under subscription validation
router.put('/:id/toggle-publish', protect, isAcademyAdmin, requireActiveSubscription('academyadmin'), toggleCourtPublish);

// Upload KYC documents
router.post('/:id/kyc', protect, isAcademyAdmin, uploadKYCDocuments);

// ==========================================
// SHARED ROUTES
// ==========================================

// Court change history (must be before /:id)
router.get('/:id/audit-history', protect, getCourtAuditHistory);

// Get court by ID
router.get('/:id', protect, getCourtById);

export default router;