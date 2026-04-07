import express from 'express';
import {
  register,
  bootstrapSuperAdmin,
  login,
  adminLogin,
  googleAuth,
  forgotPassword,
  resetPassword,
  sendOTP,
  verifyOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
  checkContactAvailability,
  requestMobileEmailOtp,
  verifyMobileEmailOtp,
  completeMobileOnboarding,
  getMe,
  getRoleCatalog,
  switchRole,
  logoutUser,
  updatePassword
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/bootstrap-superadmin', bootstrapSuperAdmin);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/send-phone-otp', sendPhoneOTP);
router.post('/verify-phone-otp', verifyPhoneOTP);
router.post('/check-contact', checkContactAvailability);

// Mobile passwordless (email OTP; user may not exist yet)
router.post('/mobile/request-email-otp', requestMobileEmailOtp);
router.post('/mobile/verify-email-otp', verifyMobileEmailOtp);
router.post('/mobile/complete-onboarding', protect, completeMobileOnboarding);

// Protected routes
router.get('/me', protect, getMe);
router.get('/roles', protect, getRoleCatalog);
router.post('/switch-role', protect, switchRole);
router.post('/logout', protect, logoutUser);
router.put('/update-password', protect, updatePassword);

export default router;
