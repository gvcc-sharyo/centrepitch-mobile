import express from 'express';
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  updateMemberRole,
  getTeamsByUser,
  getCoachTeamsByUser,
  getMyTeams,
  getAvailablePlayers,
  addAchievement,
  invitePlayer,
  registerTeamForEvent,
  registerExistingTeamForEvent,
  updateTeamRegistration,
  getMyEventTeams,
  getEventRegistrationRequirements,
  createAcademyTeam,
  getMyAcademyTeams,
  updateAcademyTeam,
  deleteAcademyTeam,
  inviteAcademyPlayerByEmail,
  getPlayerTeamInvites,
  respondToPlayerTeamInvite,
  leaveTeamAsPlayer
} from '../controllers/teamController.js';
import { protect, isAcademyAdmin, authorize } from '../middleware/auth.js';
import { createCheckoutRegisterTeamForEvent } from '../controllers/paymentController.js';
import {
  requireActiveSubscription,
  enforceTeamCreationLimit,
  enforceAcademyPlayerLimitForInvite,
} from '../middleware/subscription.js';

const router = express.Router();

// Public routes
router.get('/', getTeams);
// router.get('/:id', getTeamById);
router.get('/event-requirements/:eventId', getEventRegistrationRequirements);
router.get('/user/:userId/coach-teams', getCoachTeamsByUser);
router.get('/user/:userId', getTeamsByUser);

// Protected routes
// router.post('/', protect, createTeam);
// router.put('/:id', protect, updateTeam);
// router.delete('/:id', protect, deleteTeam);
// router.post('/:id/members', protect, addMember);
// router.delete('/:id/members/:memberId', protect, removeMember);
// router.put('/:id/members/:memberId', protect, updateMemberRole);
// router.post('/:id/achievements', protect, addAchievement);
// router.post('/:id/invite', protect, invitePlayer);

router.use(protect);

// Academy team routes (before parameterized routes)
router.get('/academy/my', isAcademyAdmin, getMyAcademyTeams);
router.post('/academy', isAcademyAdmin, requireActiveSubscription('academyadmin'), enforceTeamCreationLimit(), createAcademyTeam);
router.put('/academy/:id', isAcademyAdmin, updateAcademyTeam);
router.delete('/academy/:id', isAcademyAdmin, deleteAcademyTeam);
router.post('/academy/:id/invite-email', isAcademyAdmin, requireActiveSubscription('academyadmin'), enforceAcademyPlayerLimitForInvite(), inviteAcademyPlayerByEmail);

// Protected specific routes (before parameterized routes)
router.get('/my', getMyTeams);
router.get('/available-players', getAvailablePlayers);
router.get('/my-event-teams', getMyEventTeams);
router.post('/register-for-event', registerTeamForEvent);
router.get('/player/invites', getPlayerTeamInvites);
router.put('/:id/respond-invite', respondToPlayerTeamInvite);
router.put('/:id/leave', leaveTeamAsPlayer);
router.post(
  '/checkout-register-for-event',
  authorize('coach', 'academyadmin', 'organizer'),
  createCheckoutRegisterTeamForEvent
);
router.post('/register-existing-for-event', registerExistingTeamForEvent);

// Team CRUD with :id parameter
router.get('/:id', getTeamById);
router.post('/', requireActiveSubscription('organizer', 'coach', 'academyadmin'), enforceTeamCreationLimit(), createTeam);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);

// Member management
router.post('/:id/members', addMember);
router.delete('/:id/members/:memberId', removeMember);
router.put('/:id/members/:memberId', updateMemberRole);

// Team features
router.post('/:id/achievements', addAchievement);
router.post('/:id/invite', invitePlayer);

// Event registration update
router.put('/:id/event-registration', updateTeamRegistration);

export default router;
