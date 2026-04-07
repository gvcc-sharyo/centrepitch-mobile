import express from 'express';
import {
  getAcademyPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getMyPlayerProfile,
  updateMyPlayerProfile,
  getMyScheduledMatches,
} from '../controllers/playerController.js';
import { protect, isAcademyAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Self-service player profile (any logged-in player)
router.get('/me', getMyPlayerProfile);
router.put('/me', updateMyPlayerProfile);
router.get('/my-matches', getMyScheduledMatches);

// Academy player pool routes
router.get('/academy', isAcademyAdmin, getAcademyPlayers);

// Single player CRUD (academy admin)
router.get('/:id', isAcademyAdmin, getPlayerById);
router.put('/:id', isAcademyAdmin, updatePlayer);
router.delete('/:id', isAcademyAdmin, deletePlayer);

export default router;
