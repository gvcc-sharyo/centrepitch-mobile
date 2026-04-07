// ==========================================
// models/Booking.js
// Court Booking Model
// ==========================================

import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    // ===== BASIC INFORMATION =====
    bookingReference: {
      type: String,
      unique: true
    },
    
    // ===== USER & COURT REFERENCES =====
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Tracks which active role created the booking (player/coach/organizer)
    bookedAsRole: {
      type: String,
      enum: ['player', 'coach', 'organizer', 'academyadmin', 'superadmin'],
      default: null
    },
    
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      required: true
    },

    // Selected sport for multi-sport courts
    selectedSport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      default: null
    },
    
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SportsAcademy',
      required: true
    },
    
    // ===== BOOKING DETAILS =====
    bookingDate: {
      type: Date,
      required: true
    },
    
    // Legacy: single slot (used when timeSlots not present)
    timeSlot: {
      startTime: { type: String },
      endTime: { type: String }
    },
    
    // Multi-slot: array of slots (source of truth when present)
    timeSlots: [{
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      status: {
        type: String,
        enum: ['ACTIVE', 'CANCELLED'],
        default: 'ACTIVE'
      }
    }],
    
    // Booking source
    source: {
      type: String,
      enum: ['SUBSCRIPTION', 'PAY_PER_HOUR'],
      default: 'PAY_PER_HOUR'
    },
    sourceRef: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceRefModel' },
    sourceRefModel: { type: String, enum: ['CourtSubscription', null], default: null },
    
    duration: {
      type: Number,
      default: 0 // in minutes; optional when timeSlots used
    },
    
    // ===== PRICING =====
    pricing: {
      basePrice: {
        type: Number,
        required: true
      },
      gst: {
        type: Number,
        default: 0
      },
      platformFee: {
        type: Number,
        default: 0
      },
      discount: {
        type: Number,
        default: 0
      },
      totalAmount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: 'INR'
      }
    },
    
    // ===== PAYMENT =====
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'PENDING'
    },
    
    paymentMethod: {
      type: String,
      enum: ['CARD', 'UPI', 'NET_BANKING', 'WALLET', 'CASH', 'OTHER']
    },
    
    paymentDetails: {
      transactionId: String,
      paymentGateway: String,
      paidAt: Date,
      paymentResponse: mongoose.Schema.Types.Mixed
    },
    
    // ===== BOOKING STATUS =====
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'CONFIRMED',
        'CHECKED_IN',
        'CANCELLED_BY_USER',
        'CANCELLED_BY_ACADEMY',
        'COMPLETED',
        'NO_SHOW',
        'REJECTED'
      ],
      default: 'PENDING_PAYMENT'
    },
    
    // ===== CANCELLATION =====
    cancellation: {
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      cancelledAt: Date,
      cancellationReason: String,
      refundAmount: Number,
      refundStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSED', 'FAILED', 'NOT_APPLICABLE']
      }
    },
    
    // ===== PARTICIPANTS =====
    participants: {
      numberOfPlayers: {
        type: Number,
        default: 1,
        min: 1
      },
      playerNames: [String],
      contactNumber: String,
      email: String
    },
    
    // ===== ADDITIONAL SERVICES =====
    additionalServices: [
      {
        serviceName: String,
        price: Number,
        quantity: Number
      }
    ],
    
    // ===== SPECIAL REQUESTS =====
    specialRequests: String,
    
    // ===== CHECK-IN/OUT =====
    checkIn: {
      checkedInAt: Date,
      checkedInBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    
    checkOut: {
      checkedOutAt: Date,
      checkedOutBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    
    // ===== RATING & REVIEW =====
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    
    review: {
      comment: String,
      reviewedAt: Date
    },
    
    // ===== NOTIFICATIONS =====
    notifications: {
      reminderSent: {
        type: Boolean,
        default: false
      },
      confirmationSent: {
        type: Boolean,
        default: false
      },
      cancellationSent: {
        type: Boolean,
        default: false
      }
    },
    
    // ===== METADATA =====
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// ===== INDEXES =====
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ court: 1, bookingDate: 1 });
bookingSchema.index({ academy: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ bookingDate: 1, 'timeSlot.startTime': 1 });

// ===== PRE-SAVE MIDDLEWARE =====

// Generate booking reference
bookingSchema.pre('save', async function(next) {
  if (!this.bookingReference) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingReference = `BK-${timestamp}-${random}`;
  }
  next();
});

// ===== METHODS =====

// Get all active slots for conflict/display (handles both timeSlot and timeSlots)
bookingSchema.methods.getActiveSlots = function() {
  if (this.timeSlots && this.timeSlots.length > 0) {
    return this.timeSlots
      .filter(s => s.status !== 'CANCELLED')
      .map(s => ({ startTime: s.startTime, endTime: s.endTime }));
  }
  if (this.timeSlot?.startTime && this.timeSlot?.endTime) {
    return [{ startTime: this.timeSlot.startTime, endTime: this.timeSlot.endTime }];
  }
  return [];
};

// Check if booking is active
bookingSchema.methods.isActive = function() {
  return ['CONFIRMED', 'CHECKED_IN', 'PENDING_PAYMENT'].includes(this.status);
};

// Check if booking can be cancelled (uses first active slot for time check)
bookingSchema.methods.canBeCancelled = function() {
  const slots = this.getActiveSlots();
  if (slots.length === 0) return false;
  const [hours, minutes] = slots[0].startTime.split(':').map(Number);
  const now = new Date();
  const bookingDateTime = new Date(this.bookingDate);
  bookingDateTime.setHours(hours, minutes || 0, 0, 0);
  
  // Can cancel if booking is at least 24 hours away
  const hoursDifference = (bookingDateTime - now) / (1000 * 60 * 60);

  return (
    this.isActive() &&
    hoursDifference >= 24 &&
    this.paymentStatus !== 'REFUNDED'
  );
};

// Calculate refund amount based on cancellation time
bookingSchema.methods.calculateRefundAmount = function() {
  if (!this.canBeCancelled()) {
    return 0;
  }
  const slots = this.getActiveSlots();
  if (slots.length === 0) return 0;
  const [hours, minutes] = slots[0].startTime.split(':').map(Number);
  const now = new Date();
  const bookingDateTime = new Date(this.bookingDate);
  bookingDateTime.setHours(hours, minutes || 0, 0, 0);
  
  const hoursDifference = (bookingDateTime - now) / (1000 * 60 * 60);
  
  // Refund policy
  if (hoursDifference >= 48) {
    return this.pricing.totalAmount; // 100% refund
  } else if (hoursDifference >= 24) {
    return this.pricing.totalAmount * 0.5; // 50% refund
  } else {
    return 0; // No refund
  }
};

// Check if booking is past (uses last active slot)
bookingSchema.methods.isPast = function() {
  const slots = this.getActiveSlots();
  if (slots.length === 0) return true;
  const last = slots[slots.length - 1];
  const [hours, minutes] = last.endTime.split(':').map(Number);
  const now = new Date();
  const bookingDateTime = new Date(this.bookingDate);
  bookingDateTime.setHours(hours, minutes || 0, 0, 0);
  return now > bookingDateTime;
};

// ===== STATIC METHODS =====

// Get user's bookings
bookingSchema.statics.getUserBookings = async function(userId, status = null, bookedAsRole = null) {
  const query = { user: userId };
  if (status) {
    query.status = status;
  }
  if (bookedAsRole) {
    const role = String(bookedAsRole || '').trim().toLowerCase();
    if (role === 'player') {
      query.$or = [
        { bookedAsRole: { $exists: false } },
        { bookedAsRole: null },
        { bookedAsRole: '' },
        { bookedAsRole: 'player' },
      ];
    } else {
      query.bookedAsRole = role;
    }
  }
  
  return await this.find(query)
    .populate({
      path: 'court',
      select: 'name sportType sportTypes courtType pricing images',
      populate: [
        { path: 'sportType', select: 'name slug' },
        { path: 'sportTypes', select: 'name slug' }
      ]
    })
    .populate('academy', 'name logo address')
    .sort({ bookingDate: -1, createdAt: -1 });
};

// Get court bookings for a specific date
bookingSchema.statics.getCourtBookingsByDate = async function(courtId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await this.find({
    court: courtId,
    bookingDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['CONFIRMED', 'PENDING_PAYMENT'] }
  }).sort({ 'timeSlot.startTime': 1 });
};

// Get academy bookings
bookingSchema.statics.getAcademyBookings = async function(academyId, filters = {}) {
  const query = { academy: academyId, ...filters };
  
  return await this.find(query)
    .populate('user', 'firstName lastName email phone')
    .populate({
      path: 'court',
      select: 'name sportType sportTypes',
      populate: [
        { path: 'sportType', select: 'name slug' },
        { path: 'sportTypes', select: 'name slug' }
      ]
    })
    .sort({ bookingDate: -1, createdAt: -1 });
};

// Check slot availability (handles both timeSlot and timeSlots)
bookingSchema.statics.isSlotAvailable = async function(courtId, date, startTime, endTime) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const overlapping = await this.findOne({
    court: courtId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['CONFIRMED', 'PENDING_PAYMENT'] },
    $or: [
      {
        $and: [
          { 'timeSlot.startTime': { $exists: true, $ne: null } },
          { 'timeSlot.startTime': { $lt: endTime } },
          { 'timeSlot.endTime': { $gt: startTime } }
        ]
      },
      {
        timeSlots: {
          $elemMatch: {
            status: { $ne: 'CANCELLED' },
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          }
        }
      }
    ]
  });
  return !overlapping;
};

// Get upcoming bookings
bookingSchema.statics.getUpcomingBookings = async function(userId, bookedAsRole = null) {
  // bookingDate is stored as a date (often at 00:00). Use start of today so
  // bookings for "today" are still treated as upcoming.
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  const query = {
    user: userId,
    bookingDate: { $gte: startOfToday },
    status: { $in: ['CONFIRMED', 'PENDING_PAYMENT'] }
  };
  if (bookedAsRole) {
    const role = String(bookedAsRole || '').trim().toLowerCase();
    if (role === 'player') {
      query.$or = [
        { bookedAsRole: { $exists: false } },
        { bookedAsRole: null },
        { bookedAsRole: '' },
        { bookedAsRole: 'player' },
      ];
    } else {
      query.bookedAsRole = role;
    }
  }

  return await this.find(query)
    .populate({
      path: 'court',
      select: 'name sportType sportTypes images',
      populate: [
        { path: 'sportType', select: 'name slug' },
        { path: 'sportTypes', select: 'name slug' }
      ]
    })
    .populate('academy', 'name address')
    .sort({ bookingDate: 1, 'timeSlot.startTime': 1 });
};

// Get booking statistics for academy
bookingSchema.statics.getAcademyStats = async function(academyId, startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        academy: mongoose.Types.ObjectId.createFromHexString(academyId.toString()),
        bookingDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);
  
  return stats;
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;