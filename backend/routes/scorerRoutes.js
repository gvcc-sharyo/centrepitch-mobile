import express from 'express';
import {
  getDashboard,
  getAssignedEvents,
  getAssignedEvent
} from '../controllers/scorerController.js';
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

// All routes require scorer authentication
router.use(protect, authorize('scorer'));

// Dashboard
router.get('/dashboard', getDashboard);

// Events
router.get('/events', getAssignedEvents);
router.get('/events/:eventId', getAssignedEvent);

// Match Scheduling Routes (scorers can schedule and update scores)
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

