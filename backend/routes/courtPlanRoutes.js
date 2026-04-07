// ==========================================
// routes/courtPlanRoutes.js
// Court Subscription Plan Routes
// ==========================================

import express from 'express';
import {
  createCourtPlan,
  getMyCourtPlans,
  getCourtPlanById,
  updateCourtPlan,
  deleteCourtPlan,
  togglePlanStatus,
  duplicatePlan,
  getPublicAcademyPlans,
  getPublicPlanById
} from '../controllers/courtPlanController.js';

import { protect, isAcademyAdmin } from '../middleware/auth.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get active plans for an academy (public)
router.get('/public/academy/:academyId', getPublicAcademyPlans);

// Get plan details (public)
router.get('/public/:id', getPublicPlanById);

// ==========================================
// ACADEMY ADMIN ROUTES
// ==========================================

// Create new plan
router.post('/', protect, isAcademyAdmin, createCourtPlan);

// Get my plans
router.get('/my', protect, isAcademyAdmin, getMyCourtPlans);

// Get plan by ID
router.get('/:id', protect, isAcademyAdmin, getCourtPlanById);

// Update plan
router.put('/:id', protect, isAcademyAdmin, updateCourtPlan);

// Delete plan
router.delete('/:id', protect, isAcademyAdmin, deleteCourtPlan);

// Toggle plan status
router.put('/:id/toggle-status', protect, isAcademyAdmin, togglePlanStatus);

// Duplicate plan
router.post('/:id/duplicate', protect, isAcademyAdmin, duplicatePlan);

export default router;
