import express from 'express';
import {
  createEvent,
  getEventPublishPricing,
  getEvents,
  getEventById,
  getMyRegisteredEvents,
  updateEvent,
  deleteEvent,
  registerForEvent,
  requestPairInvite,
  respondPairInvite,
  withdrawFromEvent,
  getRegisteredPlayers,
  updatePlayerStatus,
  addStaffToEvent,
  getUpcomingEvents,
  getFeaturedEvents,
  getLiveEvents,
  getPublicLiveMatchDetail,
  getEventsByOrganizer,
  rescheduleEvent,
  getEventParticipantIds,
  submitTeamPaymentReference
} from '../controllers/eventController.js';
import { confirmOfflineTeamEventRegistration } from '../controllers/paymentController.js';
import { protect, isOrganizerOrAdmin, optionalAuth } from '../middleware/auth.js';
import { requireActiveSubscription, enforceEventCreationLimit } from '../middleware/subscription.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/featured', getFeaturedEvents);
router.get('/live', getLiveEvents);
router.get('/live/match/:eventId/:matchId/detail', getPublicLiveMatchDetail);
router.get('/organizer/:organizerId', getEventsByOrganizer);
router.get('/my', protect, getMyRegisteredEvents);
router.get('/my-registrations', protect, getMyRegisteredEvents);
router.get('/publish-pricing', protect, isOrganizerOrAdmin, getEventPublishPricing);
router.get('/:id', optionalAuth, getEventById);
router.get('/:id/participant-ids', protect, getEventParticipantIds);

// Protected routes
router.post('/', protect, isOrganizerOrAdmin, requireActiveSubscription('organizer'), enforceEventCreationLimit(), createEvent);
router.put('/:id', protect, isOrganizerOrAdmin, requireActiveSubscription('organizer'), updateEvent);
router.delete('/:id', protect, isOrganizerOrAdmin, requireActiveSubscription('organizer'), deleteEvent);
router.post('/:id/register', protect, registerForEvent);
router.post('/:id/pair-invites', protect, requestPairInvite);
router.put('/:id/pair-invites/:notificationId/respond', protect, respondPairInvite);
router.put('/:id/withdraw', protect, withdrawFromEvent);
router.get('/:id/players', protect, isOrganizerOrAdmin, getRegisteredPlayers);
router.put('/:id/players/:playerId', protect, isOrganizerOrAdmin, updatePlayerStatus);
router.post('/:id/staff', protect, isOrganizerOrAdmin, requireActiveSubscription('organizer'), addStaffToEvent);
router.put('/:id/reschedule', protect, isOrganizerOrAdmin, requireActiveSubscription('organizer'), rescheduleEvent);
router.post(
  '/:id/team-registrations/:teamId/confirm-offline-payment',
  protect,
  isOrganizerOrAdmin,
  confirmOfflineTeamEventRegistration
);
router.post('/:id/team-registrations/submit-payment-reference', protect, submitTeamPaymentReference);

export default router;
