import express from 'express';
import {
  activateSubscription,
  confirmSubscriptionPayment,
  createAdminSubscriptionSlug,
  deactivateAdminSubscriptionSlug,
  createPlan,
  createSubscriptionPaymentIntent,
  getAdminSubscriptionRoles,
  getSubscriptionRoles,
  getAdminSubscriptionSlugs,
  getAdminPlans,
  getAdminSubscriptionUsers,
  getMySubscriptionHistory,
  getUserSubscriptionHistoryAdmin,
  getPlanBySlug,
  getPlans,
  seedPlans,
  togglePlanStatus,
  updatePlan,
} from '../controllers/subscriptionController.js';
import { authorize, protect, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public
router.get('/plans', getPlans);
router.get('/roles', getSubscriptionRoles);
router.get('/history/me', protect, authorize('player', 'academyadmin', 'coach', 'organizer'), getMySubscriptionHistory);

// Admin only
router.get('/history/admin/users/options', protect, isSuperAdmin, getAdminSubscriptionUsers);
router.get('/history/admin/users/:userId', protect, isSuperAdmin, getUserSubscriptionHistoryAdmin);
router.get('/roles/admin', protect, isSuperAdmin, getAdminSubscriptionRoles);
router.get('/slugs/admin', protect, isSuperAdmin, getAdminSubscriptionSlugs);
router.post('/slugs/admin', protect, isSuperAdmin, createAdminSubscriptionSlug);
router.patch('/slugs/admin/:slug/deactivate', protect, isSuperAdmin, deactivateAdminSubscriptionSlug);
router.get('/plans/admin', protect, isSuperAdmin, getAdminPlans);
router.post('/plans', protect, isSuperAdmin, createPlan);
router.put('/plans/:id', protect, isSuperAdmin, updatePlan);
router.patch('/plans/:id/status', protect, isSuperAdmin, togglePlanStatus);
router.post('/seed', protect, isSuperAdmin, seedPlans);

// Public (keep after /plans/admin to avoid route conflict)
router.get('/plans/:slug', getPlanBySlug);
router.post('/payment-intent', protect, authorize('player', 'academyadmin', 'coach', 'organizer'), createSubscriptionPaymentIntent);
router.post('/payment-confirm/:paymentId', protect, authorize('player', 'academyadmin', 'coach', 'organizer'), confirmSubscriptionPayment);
router.post('/activate', protect, authorize('player', 'academyadmin', 'coach', 'organizer'), activateSubscription);

export default router;
