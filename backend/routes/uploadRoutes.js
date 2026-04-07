import express from 'express';
import multer from 'multer';
import {
  uploadEventImage,
  uploadQRCode,
  uploadProfilePhoto,
  uploadTeamLogo,
  uploadFile
} from '../controllers/uploadController.js';
import { protect, isOrganizerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Multer configuration with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Upload routes - all require authentication
router.post('/event-image', protect, isOrganizerOrAdmin, upload.single('file'), uploadEventImage);
router.post('/qr-code', protect, isOrganizerOrAdmin, upload.single('file'), uploadQRCode);
router.post('/profile-photo', protect, upload.single('file'), uploadProfilePhoto);
router.post('/team-logo', protect, upload.single('file'), uploadTeamLogo);
router.post('/file', protect, upload.single('file'), uploadFile);

export default router;