import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  sendBulkNotifications
} from '../controllers/notificationController.js';
import { protect, isOrganizerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);
router.delete('/', protect, deleteAllNotifications);
router.post('/', protect, isOrganizerOrAdmin, createNotification);
router.post('/bulk', protect, isOrganizerOrAdmin, sendBulkNotifications);

export default router;
