// ==========================================
// STEP 6: CREATE models/Court.js
// ==========================================
// This is a NEW file - Create it in your models/ folder

import mongoose from 'mongoose';

const courtSchema = new mongoose.Schema(
  {
    // ===== BASIC INFORMATION =====
    name: {
      type: String,
      required: [true, 'Court name is required'],
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    
    // ===== ACADEMY REFERENCE =====
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SportsAcademy',
      required: true
    },
    
    // ===== SPORT TYPE =====
    sportType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      required: true
    },
    // Multi-sport support (backward compatible with single sportType)
    sportTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sport'
      }
    ],
    
    // ===== COURT TYPE =====
    courtType: {
      type: String,
      enum: ['INDOOR', 'OUTDOOR', 'SEMI_COVERED'],
      required: true
    },
    
    // ===== SURFACE TYPE =====
    surfaceType: {
      type: String,
      enum: [
        'GRASS',
        'ARTIFICIAL_TURF',
        'HARD_COURT',
        'CLAY',
        'CONCRETE',
        'WOOD',
        'SYNTHETIC',
        'RUBBER',
        'OTHER'
      ],
      required: true
    },
    
    // ===== DIMENSIONS =====
    dimensions: {
      length: Number,
      width: Number,
      unit: {
        type: String,
        enum: ['METERS', 'FEET'],
        default: 'METERS'
      }
    },
    
    // ===== LOCATION =====
    location: {
      building: String,
      floor: String,
      area: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    
    // ===== CAPACITY =====
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    
    // ===== AMENITIES =====
    amenities: [
      {
        type: String,
        enum: [
          'LIGHTING',
          'SEATING',
          'SCOREBOARD',
          'CHANGING_ROOM',
          'SHOWER',
          'WATER_COOLER',
          'FIRST_AID',
          'PARKING',
          'EQUIPMENT_AVAILABLE',
          'AIR_CONDITIONED',
          'CAFETERIA_NEARBY',
          'WIFI',
          'LOCKERS',
          'SOUND_SYSTEM',
          'VIDEO_RECORDING',
          'OTHER'
        ]
      }
    ],
    
    // ===== SPORT-SPECIFIC DETAILS =====
    // Dynamic fields based on sport template
    sportSpecificDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // ===== IMAGES =====
    images: [
      {
        url: {
          type: String,
          required: true
        },
        caption: String,
        isPrimary: {
          type: Boolean,
          default: false
        }
      }
    ],
    
    // ===== PRICING =====
    pricing: {
      hourlyRate: {
        type: Number,
        required: true,
        min: 0
      },
      peakHourRate: Number,
      offPeakHourRate: Number,
      weekendRate: Number,
      currency: {
        type: String,
        default: 'INR'
      },
      depositAmount: {
        type: Number,
        default: 0
      }
    },
    
    // ===== AVAILABILITY =====
    availability: {
      monday: {
        isAvailable: { type: Boolean, default: true },
        slots: [
          {
            startTime: String, // "09:00"
            endTime: String,   // "11:00"
            isBooked: { type: Boolean, default: false },
            bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
          }
        ]
      },
      tuesday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      },
      wednesday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      },
      thursday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      },
      friday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      },
      saturday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      },
      sunday: {
        isAvailable: { type: Boolean, default: true },
        slots: []
      }
    },
    
    // ===== BOOKING SETTINGS =====
    bookingSettings: {
      minBookingDuration: {
        type: Number,
        default: 60 // minutes
      },
      maxBookingDuration: {
        type: Number,
        default: 180 // minutes
      },
      advanceBookingDays: {
        type: Number,
        default: 30
      },
      cancellationPolicy: {
        type: String,
        default: 'Cancellation allowed up to 24 hours before booking'
      },
      allowInstantBooking: {
        type: Boolean,
        default: false
      }
    },
    
    // ===== RULES & REGULATIONS =====
    rules: [String],
    
    // ===== KYC & VERIFICATION =====
    kycStatus: {
      type: String,
      enum: ['INCOMPLETE', 'PENDING', 'VERIFIED', 'REJECTED'],
      default: 'INCOMPLETE'
    },
    kycDocuments: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KYC'
    },
    
    // ===== APPROVAL STATUS =====
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_KYC', 'APPROVED', 'REJECTED', 'SUSPENDED', 'MAINTENANCE'],
      default: 'DRAFT'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    
    // ===== MAINTENANCE =====
    maintenanceSchedule: [
      {
        from: {
          type: Date,
          required: true
        },
        to: {
          type: Date,
          required: true
        },
        reason: String
      }
    ],
    
    // ===== STATISTICS =====
    totalBookings: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    
    // ===== SETTINGS =====
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    
    // ===== ADDITIONAL INFO =====
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
courtSchema.index({ academy: 1, status: 1 });
courtSchema.index({ sportType: 1, status: 1 });
courtSchema.index({ sportTypes: 1, status: 1 });
courtSchema.index({ status: 1 });
courtSchema.index({ 'pricing.hourlyRate': 1 });
courtSchema.index({ courtType: 1 });

// ===== METHODS =====

// Check if court is approved
courtSchema.methods.isApproved = function() {
  return this.status === 'APPROVED';
};

// Check if court is available for booking
courtSchema.methods.isAvailableForBooking = function() {
  return this.status === 'APPROVED' && 
         this.isActive && 
         this.status !== 'MAINTENANCE';
};

// Check if court is under maintenance
courtSchema.methods.isUnderMaintenance = function() {
  const now = new Date();
  return this.maintenanceSchedule.some(schedule => 
    now >= schedule.from && now <= schedule.to
  );
};

// Get primary image
courtSchema.methods.getPrimaryImage = function() {
  const primaryImage = this.images.find(img => img.isPrimary);
  return primaryImage ? primaryImage.url : (this.images[0]?.url || null);
};

// ===== STATIC METHODS =====

// Get all approved courts (for public view)
courtSchema.statics.getApprovedCourts = async function(filters = {}) {
  return await this.find({ 
    status: 'APPROVED', 
    isActive: true,
    ...filters 
  })
    .populate('academy', 'name logo address')
    .populate('sportType', 'name slug')
    .populate('sportTypes', 'name slug')
    .sort({ averageRating: -1, createdAt: -1 });
};

// Get courts by academy
courtSchema.statics.getCourtsByAcademy = async function(academyId, includeAll = false) {
  const query = { academy: academyId };
  if (!includeAll) {
    query.status = 'APPROVED';
    query.isActive = true;
  }
  
  return await this.find(query)
    .populate('sportType', 'name slug')
    .populate('sportTypes', 'name slug')
    .sort({ createdAt: -1 });
};

// Get courts by sport type
courtSchema.statics.getCourtsBySport = async function(sportId) {
  return await this.find({
    $or: [
      { sportType: sportId },
      { sportTypes: sportId }
    ],
    status: 'APPROVED',
    isActive: true
  })
    .populate('academy', 'name logo address')
    .populate('sportTypes', 'name slug')
    .sort({ averageRating: -1 });
};

// Search courts
courtSchema.statics.searchCourts = async function(searchTerm, filters = {}) {
  const query = {
    status: 'APPROVED',
    isActive: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ],
    ...filters
  };
  
  return await this.find(query)
    .populate('academy', 'name logo address')
    .populate('sportType', 'name slug')
    .populate('sportTypes', 'name slug')
    .sort({ averageRating: -1 });
};

// Get pending courts for approval
courtSchema.statics.getPendingCourts = async function(role, userId) {
  let query = { status: 'PENDING_KYC' };
  
  if (role === 'academyadmin') {
    const academy = await mongoose.model('SportsAcademy').findOne({ adminUser: userId });
    if (!academy) return [];
    query.academy = academy._id;
  }
  
  return await this.find(query)
    .populate('academy', 'name')
    .populate('sportType', 'name')
    .populate('sportTypes', 'name')
    .sort({ createdAt: 1 });
};

const Court = mongoose.model('Court', courtSchema);

export default Court;

// ==========================================
// INTEGRATION NOTES:
// ==========================================
// 1. Create a new file: models/Court.js
// 2. Copy this entire code into that file
// 3. This model represents Courts/Venues
// 4. Key features:
//    - Detailed court information (type, surface, dimensions)
//    - Pricing structure (hourly, peak/off-peak, weekend rates)
//    - Availability scheduling
//    - Amenities tracking
//    - Booking settings
//    - Maintenance scheduling
//    - Ratings and reviews
// 5. Relationships with:
//    - SportsAcademy (academy)
//    - UserSport (sportType)
//    - User (for bookings)