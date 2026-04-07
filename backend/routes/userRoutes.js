import express from 'express';
import {
  getProfile,
  updateProfile,
  getUserById,
  addAchievement,
  updateAchievement,
  deleteAchievement,
  getPerformanceStats,
  updatePerformanceStats,
  uploadProfilePhoto
} from '../controllers/userController.js';
import { protect, isOrganizerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/performance', protect, getPerformanceStats);
router.post('/achievements', protect, addAchievement);
router.put('/achievements/:achievementId', protect, updateAchievement);
router.delete('/achievements/:achievementId', protect, deleteAchievement);
router.post('/upload-photo', protect, uploadProfilePhoto);
router.put('/performance', protect, isOrganizerOrAdmin, updatePerformanceStats);
router.get('/:id', protect, getUserById);

export default router;
