import express from 'express';
import {
  createStaff,
  getStaffMembers,
  getStaffById,
  updateStaff,
  deleteStaff,
  assignToEvent,
  removeFromEvent,
  getAvailableStaff
} from '../controllers/staffController.js';
import { protect, isOrganizerOrAdmin, isAcademyAdmin } from '../middleware/auth.js';

const router = express.Router();

// Allow organizer, academy admin, or super admin
const canManageStaff = (req, res, next) => {
  const allowed = ['organizer', 'superadmin', 'academyadmin'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Not authorized to manage staff.'
    });
  }
  next();
};

router.use(protect, canManageStaff);

router.post('/', createStaff);
router.get('/', getStaffMembers);
router.get('/available/:eventId', getAvailableStaff);
router.get('/:id', getStaffById);
router.put('/:id', updateStaff);
router.delete('/:id', deleteStaff);
router.post('/:id/assign', assignToEvent);
router.delete('/:id/events/:eventId', removeFromEvent);

export default router;
