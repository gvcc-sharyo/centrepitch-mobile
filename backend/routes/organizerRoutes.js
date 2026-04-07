import express from 'express';
import {
  getDashboard,
  getAvailablePlayers,
  getOrganizerTeams,
  getCoachTeams,
  getMyEvents,
  addTeamToEvent,
  getEventParticipants,
  updateParticipantStatus,
  getEventRevenue,
  contactSuperAdmin,
  getMyQueries,
  getMyQuery,
  getRevenueAnalytics,
  createScorer,
  getScorers,
  assignScorerToEvent,
  removeScorerFromEvent,
  sendEventAnnouncement
} from '../controllers/organizerController.js';
import {
  getEventSchedule,
  createRound,
  createMatch,
  updateMatch,
  updateMatchResult,
  deleteMatch,
  deleteRound,
  getParticipantsForScheduling,
  getEventStandings,
  upsertMatchStats,
  getMatchStats
} from '../controllers/matchController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require organizer or superadmin authentication
router.use(protect, authorize('organizer', 'superadmin'));

router.get('/dashboard', getDashboard);
router.get('/available-players', getAvailablePlayers);
router.get('/teams', getOrganizerTeams);
router.get('/coach-teams', getCoachTeams);
router.get('/events', getMyEvents);
router.post('/events/:eventId/announcement', sendEventAnnouncement);
router.post('/events/:eventId/teams', addTeamToEvent);
router.get('/events/:eventId/participants', getEventParticipants);
router.put('/events/:eventId/participants/:participantId', updateParticipantStatus);
router.get('/events/:eventId/revenue', getEventRevenue);
router.post('/contact-admin', contactSuperAdmin);
router.get('/queries', getMyQueries);
router.get('/queries/:id', getMyQuery);
router.get('/revenue-analytics', getRevenueAnalytics);

// Scorer Management Routes
router.post('/scorers', createScorer);
router.get('/scorers', getScorers);
router.post('/events/:eventId/assign-scorer', assignScorerToEvent);
router.delete('/events/:eventId/scorers/:scorerId', removeScorerFromEvent);

// Match Scheduling Routes
router.get('/events/:eventId/schedule', getEventSchedule);
router.get('/events/:eventId/scheduling-participants', getParticipantsForScheduling);
router.get('/events/:eventId/standings', getEventStandings);
router.post('/events/:eventId/schedule/rounds', createRound);
router.delete('/events/:eventId/schedule/rounds/:roundName', deleteRound);
router.post('/events/:eventId/schedule/matches', createMatch);
router.put('/events/:eventId/schedule/matches/:matchId', updateMatch);
router.put('/events/:eventId/schedule/matches/:matchId/result', updateMatchResult);
router.get('/events/:eventId/schedule/matches/:matchId/stats', getMatchStats);
router.put('/events/:eventId/schedule/matches/:matchId/stats', upsertMatchStats);
router.delete('/events/:eventId/schedule/matches/:matchId', deleteMatch);

export default router;
