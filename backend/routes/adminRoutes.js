import express from 'express';
import {
  getDashboardStats,
  getOrganizers,
  addOrganizer,
  updateOrganizerStatus,
  deleteOrganizer,
  getRegistrations,
  getPlayers,
  updatePlayerStatus,
  activateAllInactiveAccounts,
  getAllEvents,
  getRevenueAnalysis,
  getEventPublishPricing,
  updateEventPublishPricing,
  upsertSportEventPublishPricing,
  getAdminNotifications,
  sendAnnouncement,
  getQueries,
  getQuery,
  updateQueryStatus,
  respondToQuery
} from '../controllers/adminController.js';
import { protect, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require super admin authentication
router.use(protect, isSuperAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/organizers', getOrganizers);
router.post('/organizers', addOrganizer);
router.put('/organizers/:id/status', updateOrganizerStatus);
router.delete('/organizers/:id', deleteOrganizer);
router.get('/registrations', getRegistrations);
router.get('/players', getPlayers);
router.put('/players/:id/status', updatePlayerStatus);
router.put('/users/activate-all', activateAllInactiveAccounts);
router.get('/events', getAllEvents);
router.get('/revenue', getRevenueAnalysis);
router.get('/event-publish-pricing', getEventPublishPricing);
router.put('/event-publish-pricing', updateEventPublishPricing);
router.put('/event-publish-pricing/sports/:sportId', upsertSportEventPublishPricing);
router.get('/notifications', getAdminNotifications);
router.post('/announcement', sendAnnouncement);
router.get('/queries', getQueries);
router.get('/queries/:id', getQuery);
router.put('/queries/:id/status', updateQueryStatus);
router.post('/queries/:id/respond', respondToQuery);

export default router;
