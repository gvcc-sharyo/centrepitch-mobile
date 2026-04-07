// ==========================================
// controllers/courtSubscriptionController.js
// Court Subscription (Player) - Subscribe to plans, get available slots
// ==========================================

import CourtSubscription from '../models/CourtSubscription.js';
import CourtSubscriptionPlan from '../models/CourtSubscriptionPlan.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const normalizeSportIds = (value) => {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map((v) => String(v)).filter(Boolean))];
};

/**
 * Parse time string "HH:mm" to hour number
 */
function parseHour(timeStr) {
  const [h] = (timeStr || '00:00').split(':').map(Number);
  return h;
}

/**
 * Build all sessions for a date (available + booked) based on plan + existing bookings
 * Returns all slots with { date, startTime, endTime, duration, available: true|false }
 */
async function getSessionsForDate(courtId, dateStr, plan) {
  const planConfig = plan.sessionConfig || {};
  const timeRest = plan.timeRestrictions || {};
  // Slot duration = exactly what academy set (1hr plan → 1hr slots only, 4hr plan → 4hr slots only)
  const duration = planConfig.maxHoursPerSession || 1;
  const startH = parseHour(timeRest.allowedTimeStart || '06:00');
  const endH = parseHour(timeRest.allowedTimeEnd || '22:00');

  const date = new Date(dateStr + 'T00:00:00');
  const dayName = DAY_NAMES[date.getDay()];
  const allowedDays = timeRest.allowedDays || DAY_NAMES.slice(1, 6);
  if (!allowedDays.map(d => d.toLowerCase()).includes(dayName)) {
    return [];
  }

  const existingBookings = await Booking.getCourtBookingsByDate(courtId, dateStr);

  const sessions = [];
  const seenKeys = new Set();
  for (let h = startH; h + duration <= endH; h += duration) {
      const sh = Math.floor(h);
      const sm = Math.round((h % 1) * 60);
      const endHActual = h + duration;
      const eh = Math.floor(endHActual);
      const em = Math.round((endHActual % 1) * 60);
      const startTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      const isBooked = existingBookings.some(b => {
        const slots = b.getActiveSlots ? b.getActiveSlots() : (b.timeSlot ? [{ startTime: b.timeSlot.startTime, endTime: b.timeSlot.endTime }] : []);
        return slots.some(s => startTime < s.endTime && endTime > s.startTime);
      });

      const key = `${dateStr}-${startTime}-${endTime}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sessions.push({ date: dateStr, startTime, endTime, duration, available: !isBooked });
      }
  }
  return sessions;
}

/**
 * @desc    Get available subscription slots (only available, not booked)
 * @route   GET /api/court-subscriptions/available-slots
 * @query   courtId, planId, startDate, endDate
 * @access  Public
 */
export const getAvailableSubscriptionSlots = async (req, res) => {
  try {
    const { courtId, planId, startDate, endDate } = req.query;
    if (!courtId || !planId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'courtId, planId, startDate, endDate are required'
      });
    }

    const plan = await CourtSubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    if (!plan.isActive || plan.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Plan is not active' });
    }

    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const timeRest = plan.timeRestrictions || {};
    const allowedDays = timeRest.allowedDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const durationMonths = plan.durationMonths || 1;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayNamesLower = allowedDays.map(d => d.toLowerCase());

    const result = {};
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayName = DAY_NAMES[current.getDay()];
      if (dayNamesLower.includes(dayName)) {
        const sessions = await getSessionsForDate(courtId, dateStr, plan);
        if (sessions.length > 0) {
          result[dateStr] = sessions;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    const planLimits = {
      sessionsPerMonth: plan.sessionConfig?.sessionsPerMonth,
      sessionsPerWeek: plan.sessionConfig?.sessionsPerWeek,
      totalSessionsInPlan: plan.sessionConfig?.totalSessionsInPlan,
      maxHoursPerSession: plan.sessionConfig?.maxHoursPerSession
    };

    res.status(200).json({
      success: true,
      data: { slots: result, planLimits }
    });
  } catch (error) {
    console.error('Get available subscription slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available slots',
      error: error.message
    });
  }
};

/**
 * @desc    Create court subscription (player subscribes)
 * @route   POST /api/court-subscriptions
 * @access  Private
 */
export const createCourtSubscription = async (req, res) => {
  try {
    const { planId, courtId, selectedSessions, selectedSportId, paymentDetails = {} } = req.body;

    if (!planId || !courtId || !selectedSessions || !Array.isArray(selectedSessions)) {
      return res.status(400).json({
        success: false,
        message: 'planId, courtId and selectedSessions (array) are required'
      });
    }

    const plan = await CourtSubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    if (!plan.isAvailableForSubscription()) {
      return res.status(400).json({ success: false, message: 'Plan is not available for subscription' });
    }

    const court = await Court.findById(courtId).populate('academy');
    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const academyId = court.academy?._id || court.academy;
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

    const totalSessions = plan.sessionConfig?.totalSessionsInPlan || plan.sessionConfig?.sessionsPerMonth * (plan.durationMonths || 1) || selectedSessions.length;
    if (selectedSessions.length > totalSessions) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${totalSessions} sessions allowed for this plan`
      });
    }

    for (const s of selectedSessions) {
      const sessionsForDate = await getSessionsForDate(courtId, s.date, plan);
      const found = sessionsForDate.some(a => a.available && a.startTime === s.startTime && a.endTime === s.endTime);
      if (!found) {
        return res.status(400).json({
          success: false,
          message: `Slot ${s.date} ${s.startTime}-${s.endTime} is no longer available`
        });
      }
    }

    const now = new Date();
    const startDate = now;
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + (plan.durationMonths || 1));

    const amount = plan.tax?.totalAmount ?? plan.pricing?.basePrice ?? 0;

    const subscription = await CourtSubscription.create({
      user: req.user._id,
      plan: planId,
      court: courtId,
      academy: academyId,
      startDate,
      endDate,
      selectedSessions,
      sessionsUsed: 0,
      remainingSessions: selectedSessions.length,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paymentDetails: {
        transactionId: paymentDetails.transactionId || `CSUB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        paymentGateway: paymentDetails.paymentGateway || 'DUMMY_GATEWAY',
        paidAt: now,
        amount,
        currency: 'INR'
      }
    });

    // Group sessions by date → one booking per (court, date) with multiple slots
    const byDate = {};
    for (const s of selectedSessions) {
      const d = s.date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ startTime: s.startTime, endTime: s.endTime, status: 'ACTIVE' });
    }

    for (const dateStr of Object.keys(byDate)) {
      const slots = byDate[dateStr];
      const totalMinutes = slots.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return sum + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);

      const bookedAsRole = String(req.user?.activeRole || req.user?.role || '').trim().toLowerCase() || null;
      await Booking.create({
        user: req.user._id,
        bookedAsRole,
        court: courtId,
        academy: academyId,
        selectedSport: bookingSportId,
        bookingDate: new Date(dateStr + 'T00:00:00'),
        timeSlots: slots,
        source: 'SUBSCRIPTION',
        sourceRef: subscription._id,
        sourceRefModel: 'CourtSubscription',
        duration: totalMinutes,
        pricing: {
          basePrice: 0,
          gst: 0,
          platformFee: 0,
          discount: 0,
          totalAmount: 0,
          currency: 'INR'
        },
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        paymentDetails: {
          transactionId: subscription.paymentDetails.transactionId,
          paymentGateway: subscription.paymentDetails.paymentGateway,
          paidAt: now,
          paymentResponse: { source: 'COURT_SUBSCRIPTION', subscriptionId: subscription._id }
        },
        metadata: { courtSubscription: subscription._id }
      });
    }

    plan.limits.currentSubscribers = (plan.limits.currentSubscribers || 0) + 1;
    plan.stats = plan.stats || {};
    plan.stats.totalSubscriptions = (plan.stats.totalSubscriptions || 0) + 1;
    plan.stats.activeSubscriptions = (plan.stats.activeSubscriptions || 0) + 1;
    plan.stats.totalRevenue = (plan.stats.totalRevenue || 0) + amount;
    await plan.save();

    await subscription.populate(['plan', 'court', 'academy']);

    res.status(201).json({
      success: true,
      message: 'Subscription activated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Create court subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message
    });
  }
};

/**
 * @desc    Get subscription by ID (own only)
 * @route   GET /api/court-subscriptions/:id
 * @access  Private
 */
export const getSubscriptionById = async (req, res) => {
  try {
    const subscription = await CourtSubscription.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('plan', 'name durationMonths sessionConfig timeRestrictions pricing tax')
      .populate({
        path: 'court',
        select: 'name sportType courtType surfaceType capacity',
        populate: { path: 'sportType', select: 'name' }
      })
      .populate('academy', 'name logo');

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    console.error('Get subscription by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message
    });
  }
};

/**
 * @desc    Get my court subscriptions
 * @route   GET /api/court-subscriptions/my
 * @access  Private
 */
export const getMyCourtSubscriptions = async (req, res) => {
  try {
    const subscriptions = await CourtSubscription.find({ user: req.user._id })
      .populate('plan', 'name durationMonths sessionConfig timeRestrictions pricing tax')
      .populate({
        path: 'court',
        select: 'name sportType courtType surfaceType capacity',
        populate: { path: 'sportType', select: 'name' }
      })
      .populate('academy', 'name logo')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    console.error('Get my court subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message
    });
  }
};
