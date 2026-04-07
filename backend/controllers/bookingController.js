// ==========================================
// controllers/bookingController.js
// Court Booking Controller
// ==========================================

import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Court from '../models/Court.js';
import SportsAcademy from '../models/SportsAcademy.js';
import CourtSubscription from '../models/CourtSubscription.js';
import Sport from '../models/Sport.js';

const normalizeSportIds = (value) => {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map((v) => String(v)).filter(Boolean))];
};

const hydrateSelectedSports = async (bookings = []) => {
  if (!Array.isArray(bookings) || bookings.length === 0) return bookings;

  const sportIds = bookings
    .map((booking) => {
      const selected = booking?.selectedSport;
      if (!selected) return '';
      if (typeof selected === 'object') {
        if (selected?.name) return '';
        return String(selected?._id || '');
      }
      return String(selected);
    })
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

  if (sportIds.length === 0) return bookings;

  const sports = await Sport.find({ _id: { $in: sportIds } })
    .select('_id name slug')
    .lean();
  const sportById = new Map(sports.map((sport) => [String(sport._id), sport]));

  bookings.forEach((booking) => {
    const selected = booking?.selectedSport;
    if (!selected) return;
    if (typeof selected === 'object' && selected?.name) return;

    const id =
      typeof selected === 'object'
        ? String(selected?._id || '')
        : String(selected);
    const matched = sportById.get(id);
    if (matched) {
      booking.selectedSport = matched;
    }
  });

  return bookings;
};

// ==========================================
// PLAYER BOOKING OPERATIONS
// ==========================================

/**
 * @desc    Create new booking
 * @route   POST /api/bookings
 * @access  Private/Player
 */
export const createBooking = async (req, res) => {
  try {
    const {
      courtId,
      bookingDate,
      startTime,
      endTime,
      selectedSportId,
      numberOfPlayers,
      playerNames,
      contactNumber,
      specialRequests,
      additionalServices
    } = req.body;

    // Validate court exists and is approved
    const court = await Court.findById(courtId).populate('academy');
    
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    if (court.status !== 'APPROVED' || !court.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Court is not available for booking'
      });
    }

    // Validate selected sport for multi-sport courts
    const courtSportIds = normalizeSportIds([
      ...(Array.isArray(court.sportTypes) ? court.sportTypes : []),
      court.sportType
    ]);
    const requestedSportId = selectedSportId ? String(selectedSportId) : null;

    let bookingSportId = null;
    if (courtSportIds.length > 1) {
      if (!requestedSportId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a sport for this multi-sport court'
        });
      }
      if (!courtSportIds.includes(requestedSportId)) {
        return res.status(400).json({
          success: false,
          message: 'Selected sport is not supported by this court'
        });
      }
      bookingSportId = requestedSportId;
    } else if (courtSportIds.length === 1) {
      bookingSportId = courtSportIds[0];
    }

    // Check if booking date is not in the past (compare date only, ignore time)
    const bookingDateTime = new Date(bookingDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (bookingDateTime < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book for past dates'
      });
    }

    // Check advance booking limit
    const maxAdvanceDays = court.bookingSettings?.advanceBookingDays || 30;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
    
    if (bookingDateTime > maxDate) {
      return res.status(400).json({
        success: false,
        message: `Bookings can only be made ${maxAdvanceDays} days in advance`
      });
    }

    // Check slot availability
    const isAvailable = await Booking.isSlotAvailable(
      courtId,
      bookingDate,
      startTime,
      endTime
    );

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    // Calculate duration
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    // Validate duration
    const minDuration = court.bookingSettings?.minBookingDuration || 60;
    const maxDuration = court.bookingSettings?.maxBookingDuration || 180;

    if (duration < minDuration || duration > maxDuration) {
      return res.status(400).json({
        success: false,
        message: `Booking duration must be between ${minDuration} and ${maxDuration} minutes`
      });
    }

    // Calculate pricing
    const hours = duration / 60;
    let basePrice = court.pricing.hourlyRate * hours;

    // Apply peak/off-peak rates if applicable
    const dayOfWeek = bookingDateTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend && court.pricing.weekendRate) {
      basePrice = court.pricing.weekendRate * hours;
    }

    // Add additional services cost
    let additionalServicesCost = 0;
    if (additionalServices && additionalServices.length > 0) {
      additionalServicesCost = additionalServices.reduce(
        (sum, service) => sum + (service.price * service.quantity),
        0
      );
    }

    const subtotal = basePrice + additionalServicesCost;
    const gst = subtotal * 0.18; // 18% GST
    const platformFee = subtotal * 0.02; // 2% platform fee
    const totalAmount = subtotal + gst + platformFee;
    const bookedAsRole = String(req.user?.activeRole || req.user?.role || '').trim().toLowerCase() || null;

    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      bookedAsRole,
      court: courtId,
      academy: court.academy._id,
      selectedSport: bookingSportId,
      bookingDate,
      timeSlot: {
        startTime,
        endTime
      },
      duration,
      pricing: {
        basePrice,
        gst,
        platformFee,
        discount: 0,
        totalAmount,
        currency: court.pricing.currency
      },
      participants: {
        numberOfPlayers: numberOfPlayers || 1,
        playerNames: playerNames || [],
        contactNumber: contactNumber || req.user.phone,
        email: req.user.email
      },
      additionalServices: additionalServices || [],
      specialRequests,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING'
    });

    // Populate before sending response
    await booking.populate([
      {
        path: 'court',
        select: 'name sportType sportTypes courtType images pricing',
        populate: [
          { path: 'sportType', select: 'name slug' },
          { path: 'sportTypes', select: 'name slug' }
        ]
      },
      { path: 'academy', select: 'name logo address phone' }
    ]);

    const bookingPayload = booking.toObject();
    await hydrateSelectedSports([bookingPayload]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Please complete payment.',
      data: bookingPayload
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
};

/**
 * @desc    Get available time slots for a court
 * @route   GET /api/bookings/available-slots/:courtId
 * @access  Public
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { courtId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const court = await Court.findById(courtId);

    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    // Get day of week
    const bookingDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[bookingDate.getDay()];

    // Get court availability for this day
    const dayAvailability = court.availability[dayName];

    if (!dayAvailability || !dayAvailability.isAvailable) {
      return res.status(200).json({
        success: true,
        message: 'Court is not available on this day',
        data: []
      });
    }

    // Get existing bookings for this date
    const existingBookings = await Booking.getCourtBookingsByDate(courtId, date);

    // Generate all possible slots (assume 1-hour slots from 6 AM to 10 PM)
    const allSlots = [];
    for (let hour = 6; hour < 22; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      // Check if slot is booked (handles both timeSlot and timeSlots)
      const isBooked = existingBookings.some(booking => {
        const slots = booking.getActiveSlots ? booking.getActiveSlots() : [];
        return slots.some(s => startTime < s.endTime && endTime > s.startTime);
      });

      allSlots.push({
        startTime,
        endTime,
        available: !isBooked,
        price: court.pricing.hourlyRate
      });
    }

    res.status(200).json({
      success: true,
      data: allSlots
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available slots',
      error: error.message
    });
  }
};

/**
 * @desc    Get my bookings
 * @route   GET /api/bookings/my
 * @access  Private/Player
 */
export const getMyBookings = async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    const bookedAsRole = String(req.user?.activeRole || req.user?.role || '').trim().toLowerCase() || null;

    let bookings;

    if (upcoming === 'true') {
      bookings = await Booking.getUpcomingBookings(req.user._id, bookedAsRole);
    } else {
      bookings = await Booking.getUserBookings(req.user._id, status, bookedAsRole);
    }

    // Group subscription bookings: same court + same date + same sourceRef → one card
    const getSubRef = (doc) => {
      const v = doc.sourceRef || (typeof doc.metadata?.get === 'function' ? doc.metadata.get('courtSubscription') : doc.metadata?.courtSubscription);
      return v ? String(v) : null;
    };

    const grouped = [];
    const seen = new Set();

    for (const b of bookings) {
      const courtId = (b.court?._id || b.court)?.toString();
      const dateStr = new Date(b.bookingDate).toISOString().split('T')[0];
      const subRef = getSubRef(b);
      const groupKey = subRef ? `${courtId}-${dateStr}-${subRef}` : b._id.toString();

      if (seen.has(groupKey)) continue;

      if (subRef) {
        const siblings = bookings.filter(x => {
          const xCourt = (x.court?._id || x.court)?.toString();
          const xDate = new Date(x.bookingDate).toISOString().split('T')[0];
          const xSub = getSubRef(x);
          return xCourt === courtId && xDate === dateStr && xSub === subRef;
        });

        if (siblings.length > 1) {
          const slots = [];
          let totalAmount = 0;
          for (const s of siblings) {
            if (s.timeSlots?.length) {
              s.timeSlots.filter(t => t.status !== 'CANCELLED').forEach(t => slots.push(t));
            } else if (s.timeSlot?.startTime) {
              slots.push({ startTime: s.timeSlot.startTime, endTime: s.timeSlot.endTime, status: 'ACTIVE' });
            }
            totalAmount += s.pricing?.totalAmount || 0;
          }
          const merged = { ...siblings[0].toObject(), _id: siblings[0]._id };
          merged.timeSlots = slots;
          merged.pricing = { ...(merged.pricing || {}), totalAmount };
          grouped.push(merged);
          seen.add(groupKey);
          continue;
        }
      }

      seen.add(groupKey);
      grouped.push(b);
    }

    const rawResult = grouped.length > 0 ? grouped : bookings;
    const result = rawResult.map((item) =>
      typeof item?.toObject === 'function' ? item.toObject() : item
    );
    await hydrateSelectedSports(result);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

/**
 * @desc    Get booking by ID
 * @route   GET /api/bookings/:id
 * @access  Private
 */
export const getBookingById = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate({
        path: 'court',
        select: 'name sportType sportTypes courtType surfaceType images pricing',
        populate: [
          { path: 'sportType', select: 'name slug' },
          { path: 'sportTypes', select: 'name slug' }
        ]
      })
      .populate('academy', 'name logo address phone email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Merge sibling subscription bookings (same court + date + sourceRef) for detail view
    const subRef = booking.sourceRef?.toString() || booking.metadata?.get?.('courtSubscription') || booking.metadata?.courtSubscription;
    if (subRef && booking.user?.toString() === req.user._id.toString()) {
      const courtId = booking.court?._id || booking.court;
      const dateStr = new Date(booking.bookingDate).toISOString().split('T')[0];
      const startOfDay = new Date(dateStr + 'T00:00:00');
      const endOfDay = new Date(dateStr + 'T23:59:59');
      const siblings = await Booking.find({
        user: req.user._id,
        court: courtId,
        bookingDate: { $gte: startOfDay, $lte: endOfDay },
        _id: { $ne: booking._id },
        $or: [
          { sourceRef: subRef },
          { 'metadata.courtSubscription': subRef }
        ]
      });
      if (siblings.length > 0) {
        const slots = [...(booking.timeSlots || []).filter(s => s.status !== 'CANCELLED')];
        if (slots.length === 0 && booking.timeSlot?.startTime) {
          slots.push({ startTime: booking.timeSlot.startTime, endTime: booking.timeSlot.endTime, status: 'ACTIVE' });
        }
        for (const s of siblings) {
          if (s.timeSlots?.length) {
            s.timeSlots.filter(t => t.status !== 'CANCELLED').forEach(t => slots.push(t));
          } else if (s.timeSlot?.startTime) {
            slots.push({ startTime: s.timeSlot.startTime, endTime: s.timeSlot.endTime, status: 'ACTIVE' });
          }
        }
        booking = booking.toObject();
        booking.timeSlots = slots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        booking.pricing = booking.pricing || {};
        booking.pricing.totalAmount = (booking.pricing.totalAmount || 0) + siblings.reduce((sum, x) => sum + (x.pricing?.totalAmount || 0), 0);
      }
    }

    // For subscription bookings: attach full subscription + plan details
    const subId = booking.sourceRef?.toString?.() || (typeof booking.metadata?.get === 'function' ? booking.metadata.get('courtSubscription') : booking.metadata?.courtSubscription)?.toString?.() || (booking.metadata?.courtSubscription && String(booking.metadata.courtSubscription));
    if (subId) {
      const subscription = await CourtSubscription.findById(subId)
        .populate('plan', 'name description durationMonths sessionConfig timeRestrictions pricing tax features')
        .populate('court', 'name sportType courtType images')
        .populate('academy', 'name logo address phone email');
      if (subscription) {
        booking.subscription = subscription;
      }
    }

    // Check access rights
    const isOwner = (booking.user?._id || booking.user)?.toString() === req.user._id.toString();
    const isAcademyAdmin = req.user.role === 'academyadmin';
    const isSuperAdmin = req.user.role === 'superadmin';

    if (!isOwner && !isAcademyAdmin && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const bookingPayload =
      typeof booking?.toObject === 'function' ? booking.toObject() : booking;
    await hydrateSelectedSports([bookingPayload]);

    res.status(200).json({
      success: true,
      data: bookingPayload
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel booking
 * @route   PUT /api/bookings/:id/cancel
 * @access  Private/Player
 */
export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled. Cancellations must be made at least 24 hours before the booking time.'
      });
    }

    // Calculate refund
    const refundAmount = booking.calculateRefundAmount();

    booking.status = 'CANCELLED_BY_USER';
    booking.cancellation = {
      cancelledBy: req.user._id,
      cancelledAt: Date.now(),
      cancellationReason: reason,
      refundAmount,
      refundStatus: refundAmount > 0 ? 'PENDING' : 'NOT_APPLICABLE'
    };

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
        refundAmount
      }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel a specific slot within a multi-slot booking
 * @route   PUT /api/bookings/:id/cancel-slot
 * @access  Private/Player
 */
export const cancelSlot = async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'startTime and endTime are required'
      });
    }

    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    // Find slot in this booking or in sibling subscription bookings (for grouped legacy data)
    let slot = booking.timeSlots?.find(
      s => s.status === 'ACTIVE' && s.startTime === startTime && s.endTime === endTime
    );

    if (!slot && (booking.timeSlot?.startTime === startTime && booking.timeSlot?.endTime === endTime)) {
      // Legacy single-slot: cancel entire booking
      const slotDate = new Date(booking.bookingDate);
      const [sh, sm] = startTime.split(':').map(Number);
      slotDate.setHours(sh, sm || 0, 0, 0);
      if ((slotDate - new Date()) / (1000 * 60 * 60) < 24) {
        return res.status(400).json({
          success: false,
          message: 'Slots can only be cancelled at least 24 hours in advance'
        });
      }
      booking.status = 'CANCELLED_BY_USER';
      booking.cancellation = {
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        cancellationReason: 'Slot cancelled',
        refundAmount: 0,
        refundStatus: 'NOT_APPLICABLE'
      };
      await booking.save();
      return res.status(200).json({
        success: true,
        message: 'Slot cancelled successfully',
        data: booking
      });
    }

    if (!slot) {
      const subRef = booking.sourceRef?.toString() || booking.metadata?.get?.('courtSubscription') || booking.metadata?.courtSubscription;
      if (subRef) {
        const dateStr = new Date(booking.bookingDate).toISOString().split('T')[0];
        const startOfDay = new Date(dateStr + 'T00:00:00');
        const endOfDay = new Date(dateStr + 'T23:59:59');
        const siblings = await Booking.find({
          user: req.user._id,
          court: booking.court,
          bookingDate: { $gte: startOfDay, $lte: endOfDay },
          _id: { $ne: booking._id },
          $or: [{ sourceRef: subRef }, { 'metadata.courtSubscription': subRef }]
        });
        for (const sib of siblings) {
          if (sib.timeSlot?.startTime === startTime && sib.timeSlot?.endTime === endTime) {
            const slotDate = new Date(sib.bookingDate);
            const [sh, sm] = startTime.split(':').map(Number);
            slotDate.setHours(sh, sm || 0, 0, 0);
            if ((slotDate - new Date()) / (1000 * 60 * 60) >= 24) {
              sib.status = 'CANCELLED_BY_USER';
              sib.cancellation = {
                cancelledBy: req.user._id,
                cancelledAt: new Date(),
                cancellationReason: 'Slot cancelled',
                refundAmount: 0,
                refundStatus: 'NOT_APPLICABLE'
              };
              await sib.save();
              return res.status(200).json({
                success: true,
                message: 'Slot cancelled successfully',
                data: sib
              });
            }
          }
          const found = sib.timeSlots?.find(x => x.status === 'ACTIVE' && x.startTime === startTime && x.endTime === endTime);
          if (found) {
            booking = sib;
            slot = found;
            break;
          }
        }
      }
    }

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found or already cancelled'
      });
    }

    const slotDate = new Date(booking.bookingDate);
    const [sh, sm] = startTime.split(':').map(Number);
    slotDate.setHours(sh, sm || 0, 0, 0);
    const hoursToSlot = (slotDate - new Date()) / (1000 * 60 * 60);
    if (hoursToSlot < 24) {
      return res.status(400).json({
        success: false,
        message: 'Slots can only be cancelled at least 24 hours in advance'
      });
    }

    slot.status = 'CANCELLED';

    const activeCount = booking.timeSlots.filter(s => s.status === 'ACTIVE').length;
    if (activeCount === 0) {
      booking.status = 'CANCELLED_BY_USER';
      booking.cancellation = {
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        cancellationReason: 'All slots cancelled',
        refundAmount: 0,
        refundStatus: 'NOT_APPLICABLE'
      };
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Slot cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling slot',
      error: error.message
    });
  }
};

/**
 * @desc    Update payment status
 * @route   PUT /api/bookings/:id/payment
 * @access  Private/Player
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentGateway, paymentResponse } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    booking.paymentStatus = 'PAID';
    booking.paymentMethod = paymentMethod;
    booking.paymentDetails = {
      transactionId,
      paymentGateway,
      paidAt: Date.now(),
      paymentResponse
    };
    booking.status = 'CONFIRMED';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment confirmed. Booking is now confirmed.',
      data: booking
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment',
      error: error.message
    });
  }
};

/**
 * @desc    Add rating and review
 * @route   PUT /api/bookings/:id/review
 * @access  Private/Player
 */
export const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'You can only review completed bookings'
      });
    }

    booking.rating = rating;
    booking.review = {
      comment,
      reviewedAt: Date.now()
    };

    await booking.save();

    // Update court's average rating
    const court = await Court.findById(booking.court);
    const allRatings = await Booking.find({
      court: court._id,
      rating: { $exists: true }
    }).select('rating');

    const avgRating = allRatings.reduce((sum, b) => sum + b.rating, 0) / allRatings.length;
    
    court.averageRating = avgRating;
    court.totalReviews = allRatings.length;
    await court.save();

    res.status(200).json({
      success: true,
      message: 'Review submitted successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding review',
      error: error.message
    });
  }
};

// ==========================================
// ACADEMY ADMIN OPERATIONS
// ==========================================

/**
 * @desc    Get academy bookings
 * @route   GET /api/bookings/academy/my
 * @access  Private/AcademyAdmin
 */
export const getAcademyBookings = async (req, res) => {
  try {
    const { status, date, courtId } = req.query;

    // Get academy
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    let filters = {};
    if (status) filters.status = status;
    if (courtId) filters.court = courtId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filters.bookingDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const bookings = await Booking.getAcademyBookings(academy._id, filters);
    const bookingPayload = bookings.map((item) =>
      typeof item?.toObject === 'function' ? item.toObject() : item
    );
    await hydrateSelectedSports(bookingPayload);

    res.status(200).json({
      success: true,
      count: bookingPayload.length,
      data: bookingPayload
    });
  } catch (error) {
    console.error('Get academy bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

/**
 * @desc    Check-in booking
 * @route   PUT /api/bookings/:id/checkin
 * @access  Private/AcademyAdmin
 */
export const checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    // Time validation: allow check-in only 15 min before slot start until slot end
    const bookingDate = new Date(booking.bookingDate);
    const [startH, startM] = booking.timeSlot.startTime.split(':').map(Number);
    const [endH, endM] = booking.timeSlot.endTime.split(':').map(Number);

    const slotStart = new Date(bookingDate);
    slotStart.setHours(startH, startM, 0, 0);

    const slotEnd = new Date(bookingDate);
    slotEnd.setHours(endH, endM, 0, 0);

    const now = new Date();
    const EARLY_WINDOW_MINUTES = 15;
    const earlyWindow = new Date(slotStart.getTime() - EARLY_WINDOW_MINUTES * 60 * 1000);

    if (now < earlyWindow) {
      const startFormatted = slotStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return res.status(400).json({
        success: false,
        message: `Too early to check in. Check-in opens 15 minutes before the slot at ${startFormatted}`
      });
    }

    if (now > slotEnd) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check in — the booking slot has already ended'
      });
    }

    booking.status = 'CHECKED_IN';
    booking.checkIn = {
      checkedInAt: now,
      checkedInBy: req.user._id
    };

    await booking.save();

    const checkedInTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    res.status(200).json({
      success: true,
      message: `Checked in successfully at ${checkedInTime}`,
      data: booking
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking in booking',
      error: error.message
    });
  }
};

/**
 * @desc    Check-out booking
 * @route   PUT /api/bookings/:id/checkout
 * @access  Private/AcademyAdmin
 */
export const checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'CHECKED_IN' || !booking.checkIn?.checkedInAt) {
      return res.status(400).json({
        success: false,
        message: 'Booking must be checked in first'
      });
    }

    // Time validation: check-out allowed only after at least 5 minutes of check-in
    const now = new Date();
    const checkInTime = new Date(booking.checkIn.checkedInAt);
    const MIN_SESSION_MINUTES = 5;
    const minCheckOut = new Date(checkInTime.getTime() + MIN_SESSION_MINUTES * 60 * 1000);

    if (now < minCheckOut) {
      return res.status(400).json({
        success: false,
        message: `Too early to check out. Please wait at least ${MIN_SESSION_MINUTES} minutes after check-in`
      });
    }

    booking.checkOut = {
      checkedOutAt: now,
      checkedOutBy: req.user._id
    };
    booking.status = 'COMPLETED';

    await booking.save();

    const checkedOutTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    res.status(200).json({
      success: true,
      message: `Checked out successfully at ${checkedOutTime}`,
      data: booking
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking out booking',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel booking by academy
 * @route   PUT /api/bookings/:id/cancel-academy
 * @access  Private/AcademyAdmin
 */
export const cancelBookingByAcademy = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Full refund when cancelled by academy
    const refundAmount = booking.pricing.totalAmount;

    booking.status = 'CANCELLED_BY_ACADEMY';
    booking.cancellation = {
      cancelledBy: req.user._id,
      cancelledAt: Date.now(),
      cancellationReason: reason,
      refundAmount,
      refundStatus: 'PENDING'
    };

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Full refund will be processed.',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

/**
 * @desc    Get booking statistics
 * @route   GET /api/bookings/academy/stats
 * @access  Private/AcademyAdmin
 */
export const getBookingStats = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const { startDate, endDate, range } = req.query;
    const now = new Date();
    let start, end;

    if (startDate && endDate) {
      start = new Date(startDate); start.setHours(0, 0, 0, 0);
      end = new Date(endDate); end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(now); end.setHours(23, 59, 59, 999);
      switch (range) {
        case 'today':
          start = new Date(now); start.setHours(0, 0, 0, 0); break;
        case 'thisWeek':
          start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); break;
        case 'lastMonth': {
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        }
        case 'thisYear':
          start = new Date(now.getFullYear(), 0, 1); break;
        default: // thisMonth
          start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      }
    }

    const academyObjectId = mongoose.Types.ObjectId.createFromHexString(academy._id.toString());
    const matchStage = { academy: academyObjectId, bookingDate: { $gte: start, $lte: end } };

    // 1. Status-wise stats
    const statusStats = await Booking.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$pricing.totalAmount' } } }
    ]);

    let totalRevenue = 0, totalBookings = 0, completedBookings = 0, confirmedBookings = 0;
    let pendingPayments = 0, pendingCount = 0, cancelledBookings = 0, checkedInBookings = 0;
    statusStats.forEach(s => {
      totalBookings += s.count;
      totalRevenue += s.revenue;
      if (s._id === 'COMPLETED') completedBookings = s.count;
      if (s._id === 'CONFIRMED') confirmedBookings = s.count;
      if (s._id === 'CHECKED_IN') checkedInBookings = s.count;
      if (s._id === 'PENDING_PAYMENT') { pendingPayments = s.revenue; pendingCount = s.count; }
      if (s._id === 'CANCELLED_BY_USER' || s._id === 'CANCELLED_BY_ACADEMY') cancelledBookings += s.count;
    });
    const averageBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    // 2. Revenue by court
    const revenueByCourt = await Booking.aggregate([
      { $match: { ...matchStage, status: { $nin: ['CANCELLED_BY_USER', 'CANCELLED_BY_ACADEMY', 'REJECTED'] } } },
      { $lookup: { from: 'courts', localField: 'court', foreignField: '_id', as: 'courtInfo' } },
      { $unwind: { path: '$courtInfo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$court', courtName: { $first: '$courtInfo.name' }, revenue: { $sum: '$pricing.totalAmount' }, bookings: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);
    const courtTotalRevenue = revenueByCourt.reduce((s, c) => s + c.revenue, 0) || 1;
    const revenueByCourtDisplay = revenueByCourt.map(c => ({
      court: c.courtName || 'Unknown Court',
      revenue: c.revenue,
      bookings: c.bookings,
      percentage: Math.round((c.revenue / courtTotalRevenue) * 100)
    }));

    // 3. Revenue by day of week
    const revenueByDay = await Booking.aggregate([
      { $match: { ...matchStage, status: { $nin: ['CANCELLED_BY_USER', 'CANCELLED_BY_ACADEMY', 'REJECTED'] } } },
      { $group: { _id: { $dayOfWeek: '$bookingDate' }, revenue: { $sum: '$pricing.totalAmount' }, bookings: { $sum: 1 } } },
      { $sort: { revenue: -1 } }
    ]);
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const topRevenueDays = revenueByDay.map(d => ({
      day: dayNames[d._id] || 'Unknown',
      amount: d.revenue,
      bookings: d.bookings
    }));

    // 4. Recent transactions
    const recentTransactions = await Booking.find({
      academy: academy._id,
      status: { $nin: ['CANCELLED_BY_USER', 'CANCELLED_BY_ACADEMY', 'REJECTED'] }
    })
      .populate('court', 'name')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const transactions = recentTransactions.map(b => ({
      _id: b._id,
      date: b.bookingDate,
      bookingReference: b.bookingReference || b._id.toString().slice(-8),
      court: b.court?.name || 'Unknown',
      customer: `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim() || 'N/A',
      amount: b.pricing?.totalAmount || 0,
      status: b.status,
      paymentStatus: b.paymentStatus || 'PENDING'
    }));

    // 5. Payment status breakdown
    const paymentBreakdown = await Booking.aggregate([
      { $match: matchStage },
      { $group: { _id: '$paymentStatus', amount: { $sum: '$pricing.totalAmount' }, count: { $sum: 1 } } }
    ]);
    const paymentTotal = paymentBreakdown.reduce((s, p) => s + p.amount, 0) || 1;
    const paymentMethods = paymentBreakdown.map(p => ({
      method: p._id === 'PAID' ? 'Paid' : p._id === 'PENDING' ? 'Pending' : p._id === 'REFUNDED' ? 'Refunded' : (p._id || 'Unknown'),
      amount: p.amount,
      count: p.count,
      percentage: Math.round((p.amount / paymentTotal) * 100)
    }));

    res.status(200).json({
      success: true,
      data: {
        totalRevenue, totalBookings, completedBookings, confirmedBookings,
        checkedInBookings, cancelledBookings, averageBookingValue,
        pendingPayments, pendingCount,
        revenueByCourtDisplay, topRevenueDays, paymentMethods, transactions,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
};

// ==========================================
// SUPER ADMIN OPERATIONS
// ==========================================

/**
 * @desc    Get all bookings (Super Admin)
 * @route   GET /api/bookings
 * @access  Private/SuperAdmin
 */
export const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('user', 'firstName lastName email')
      .populate('court', 'name sportType')
      .populate('academy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: bookings
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};