import mongoose from 'mongoose';
import Sport from './Sport.js';

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true
  },
  sport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sport',
    required: [true, 'Sport is required']
  },
  // Organizer-provided sport configuration for this specific event.
  // This enables "per-event" configuration even when the global sport is basic/seeded.
  sportConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Selected format from sport's available formats
  gameFormat: {
    type: String,
    enum: ['individual', 'doubles', 'team'],
    required: [true, 'Game format is required']
  },
  // Selected category from sport's categories (categoryId can be subdoc _id, code, or stable string)
  category: {
    categoryId: { type: String, default: null },
    name: String,
    code: String,
    minAge: Number,
    maxAge: Number,
    gender: String,
    skillLevel: String
  },
  eventType: {
    type: String,
    // required: [true, 'Event type is required'],
    enum: ['cricket', 'football', 'basketball', 'tennis', 'badminton', 'volleyball', 'hockey', 'swimming', 'athletics', 'chess', 'throwball', 'running', 'jumping', 'other'],
  },
  description: {
    type: String,
    required: [true, 'Event description is required']
  },
  bannerImages: [{
    type: String
  }],
  qr_code_image: {
    type: String
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  registrationStartDate: {
    type: Date,
    required: [true, 'Registration start date is required']
  },
  registrationEndDate: {
    type: Date,
    required: [true, 'Registration end date is required']
  },
  location: {
    venue: {
      type: String,
      required: [true, 'Venue is required']
    },
    address: String,
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: String,
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    zipCode: String,
    googleMapsLink: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
   // Registration settings based on game format
  registrationSettings: {
    maxParticipants: { type: Number, default: null },
    maxTeams: { type: Number, default: null },
    // For team events - inherited from sport settings
    teamSize: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 1 },
      playingCount: { type: Number, default: 1 },
      substitutesCount: { type: Number, default: 0 }
    },
    requiresCaptain: { type: Boolean, default: false },
    requiresViceCaptain: { type: Boolean, default: false },
    // Required fields for team members
    memberRequiredFields: [{
      type: String,
      enum: ['name', 'email', 'phone', 'dateOfBirth', 'gender', 'position', 'jerseyNumber', 'photo', 'idProof']
    }],
    // Available positions for this event (from sport)
    positions: [String],
    // Allow individual registration for team events (find team later)
    allowIndividualRegistration: { type: Boolean, default: false }
  },
  // Legacy field - kept for backward compatibility
  maxParticipants: {
    type: Number,
    default: null
  },
  teamSize: {
    type: Number,
    default: 1
  },
  registrationFee: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'live', 'completed', 'cancelled', 'postponed'],
    default: 'draft'
  },
  contactDetails: {
    email: String,
    phone: String
  },
  socialMediaLinks: {
    facebook: String,
    twitter: String,
    instagram: String,
    youtube: String,
    website: String
  },
  keywords: [{
    type: String
  }],
  registeredTeams: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'refunded', 'failed'],
      default: 'pending'
    },
    status: {
      type: String,
      enum: ['registered', 'confirmed', 'disqualified', 'withdrawn'],
      default: 'registered'
    }
  }],
  registeredPlayers: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
     partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'refunded', 'failed'],
      default: 'pending'
    },
    status: {
      type: String,
      enum: ['registered', 'confirmed', 'disqualified', 'withdrawn'],
      default: 'registered'
    },
    paymentCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  }],
  staff: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
     staffMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    role: {
      type: String,
      enum: ['referee', 'coach', 'manager', 'coordinator', 'medical', 'scorer', 'other']
    },
    name: String,
    email: String,
    phone: String
  }],
  results: [{
    position: Number,
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    score: String,
    prize: String
  }],
  schedule: [{
    round: String,
    matches: [{
      matchNumber: Number,
      team1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      team2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      player1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      player2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dateTime: Date,
      venue: String,
      result: {
        winner: mongoose.Schema.Types.ObjectId,
        score: String,
        status: {
          type: String,
          enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
          default: 'scheduled'
        }
      }
    }]
  }],
  revenue: {
    totalRegistrations: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 }
  },
  standings: [{
    rank: { type: Number, default: 0 },
    entityType: {
      type: String,
      enum: ['team', 'player'],
      required: true
    },
    entity: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    name: { type: String, default: '' },
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 },
    pointsFor: { type: Number, default: 0 },
    pointsAgainst: { type: Number, default: 0 },
    pointDiff: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now }
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishPayment: {
    status: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid'
    },
    baseAmount: {
      type: Number,
      default: 0
    },
    gstPercent: {
      type: Number,
      default: 0
    },
    gstAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    paymentRef: {
      type: String,
      default: ''
    },
    paidAt: {
      type: Date,
      default: null
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  rescheduledReason: String
}, {
  timestamps: true
});

// Pre-save hook to auto-populate eventType from sport slug
eventSchema.pre('save', async function(next) {
  // Only auto-populate if eventType is not provided and sport is set
  if (!this.eventType && this.sport) {
    try {
      // If sport is already populated (object), use it directly
      if (this.sport.slug) {
        const sportSlug = this.sport.slug.toLowerCase();
        // Map sport slug to eventType enum values
        const eventTypeMap = {
          'cricket': 'cricket',
          'football': 'football',
          'basketball': 'basketball',
          'tennis': 'tennis',
          'badminton': 'badminton',
          'volleyball': 'volleyball',
          'hockey': 'hockey',
          'swimming': 'swimming',
          'athletics': 'athletics'
        };
        this.eventType = eventTypeMap[sportSlug] || 'other';
      } else {
        // If sport is just an ObjectId, fetch it
        const sport = await Sport.findById(this.sport);
        if (sport && sport.slug) {
          const sportSlug = sport.slug.toLowerCase();
          const eventTypeMap = {
            'cricket': 'cricket',
            'football': 'football',
            'basketball': 'basketball',
            'tennis': 'tennis',
            'badminton': 'badminton',
            'volleyball': 'volleyball',
            'hockey': 'hockey',
            'swimming': 'swimming',
            'athletics': 'athletics'
          };
          this.eventType = eventTypeMap[sportSlug] || 'other';
        }
      }
    } catch (error) {
      // If error occurs, set to 'other' as fallback
      this.eventType = 'other';
    }
  }
  next();
});

// Indexes for better query performance
eventSchema.index({ sport: 1, status: 1 });
eventSchema.index({ gameFormat: 1 });
eventSchema.index({ eventType: 1, status: 1 });
eventSchema.index({ 'location.city': 1, 'location.country': 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ keywords: 1 });

// Virtual for participant count
// eventSchema.virtual('participantCount').get(function() {
//   return this.registeredTeams.length + this.registeredPlayers.length;
// });
eventSchema.virtual('participantCount').get(function () {
  const teams = this.registeredTeams?.length || 0;
  const players = this.registeredPlayers?.length || 0;
  return teams + players;
});
eventSchema.virtual('registrationStatus').get(function() {
  const now = new Date();
  if (now < this.registrationStartDate) return 'upcoming';
  if (now > this.registrationEndDate) return 'closed';
  return 'open';
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

const Event = mongoose.model('Event', eventSchema);

export default Event;
