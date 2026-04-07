    // ==========================================
// routes/bookingRoutes.js
// Booking Routes
// ==========================================

import express from 'express';
import {
  createBooking,
  getAvailableSlots,
  getMyBookings,
  getBookingById,
  cancelBooking,
  cancelSlot,
  updatePaymentStatus,
  addReview,
  getAcademyBookings,
  checkInBooking,
  checkOutBooking,
  cancelBookingByAcademy,
  getBookingStats,
  getAllBookings
} from '../controllers/bookingController.js';

import {
  protect,
  isSuperAdmin,
  isAcademyAdmin,
  isPlayer
} from '../middleware/auth.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get available slots for a court
router.get('/available-slots/:courtId', getAvailableSlots);

// ==========================================
// PLAYER ROUTES
// ==========================================

// Create new booking
router.post('/', protect, isPlayer, createBooking);

// Get my bookings
router.get('/my', protect, getMyBookings);

// Cancel booking
router.put('/:id/cancel', protect, isPlayer, cancelBooking);

// Cancel a specific slot within multi-slot booking
router.put('/:id/cancel-slot', protect, isPlayer, cancelSlot);

// Update payment status
router.put('/:id/payment', protect, isPlayer, updatePaymentStatus);

// Add review
router.put('/:id/review', protect, isPlayer, addReview);

// ==========================================
// ACADEMY ADMIN ROUTES
// ==========================================

// Get academy bookings
router.get('/academy/my', protect, isAcademyAdmin, getAcademyBookings);

// Get booking statistics
router.get('/academy/stats', protect, isAcademyAdmin, getBookingStats);

// Check-in booking
router.put('/:id/checkin', protect, isAcademyAdmin, checkInBooking);

// Check-out booking
router.put('/:id/checkout', protect, isAcademyAdmin, checkOutBooking);

// Cancel booking by academy
router.put('/:id/cancel-academy', protect, isAcademyAdmin, cancelBookingByAcademy);

// ==========================================
// SUPER ADMIN ROUTES
// ==========================================

// Get all bookings
router.get('/', protect, isSuperAdmin, getAllBookings);

// ==========================================
// SHARED ROUTES
// ==========================================

// Get booking by ID (Player, Academy Admin, Super Admin)
router.get('/:id', protect, getBookingById);

export default router;