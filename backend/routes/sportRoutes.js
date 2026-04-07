import express from 'express';
import {
  createSport,
  createPublicSport,
  updateOwnPublicSport,
  deleteOwnPublicSport,
  getSports,
  getSportById,
  updateSport,
  deleteSport,
  toggleSportStatus,
  toggleFeaturedStatus,
  getSportsList,
  getSportsStats,
  getMemberUiOptions
} from '../controllers/sportController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/list', optionalAuth, getSportsList); // list + user-owned items for logged-in user
router.get('/member-ui-options', optionalAuth, getMemberUiOptions);
router.post('/public', protect, createPublicSport); // User-owned sport creation
router.put('/public/:id', protect, updateOwnPublicSport);
router.delete('/public/:id', protect, deleteOwnPublicSport);

// Routes that can be public but show more data to admins
router.get('/',optionalAuth, getSports);
router.get('/:identifier',optionalAuth, getSportById);

// Protected routes (Super Admin only)
router.use(protect);
router.use(authorize('superadmin'));

router.post('/', createSport);
router.get('/admin/stats', getSportsStats);
router.put('/:id', updateSport);
router.delete('/:id', deleteSport);
router.patch('/:id/toggle-status', toggleSportStatus);
router.patch('/:id/toggle-featured', toggleFeaturedStatus);

export default router;