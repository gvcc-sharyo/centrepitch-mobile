// ==========================================
// routes/courtSubscriptionRoutes.js
// Court Subscription (Player) Routes
// ==========================================

import express from 'express';
import {
  getAvailableSubscriptionSlots,
  createCourtSubscription,
  getMyCourtSubscriptions,
  getSubscriptionById
} from '../controllers/courtSubscriptionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public: Get available slots for subscription (filtered by plan + bookings)
router.get('/available-slots', getAvailableSubscriptionSlots);

// Private: Create subscription (player)
router.post('/', protect, createCourtSubscription);

// Private: Get my subscriptions
router.get('/my', protect, getMyCourtSubscriptions);

// Private: Get subscription by ID
router.get('/:id', protect, getSubscriptionById);

export default router;
