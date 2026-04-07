// ==========================================
// models/Coach.js (FIXED VERSION)
// Coach Model with Optional userId for Registration
// ==========================================

import mongoose from 'mongoose';

const coachSchema = new mongoose.Schema(
  {
    // ===== PERSONAL INFORMATION =====
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // ← CHANGED: Not required during registration
      unique: true,
      sparse: true // ← ADDED: Allows null/undefined values to be non-unique
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: ''
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', ''],
      default: ''
    },
    profilePhoto: {
      type: String,
      default: null
    },
    
    // ===== COACH TYPE =====
    coachType: {
      type: String,
      enum: ['FREELANCER', 'ACADEMY_COACH', 'BOTH'],
      default: 'FREELANCER'
    },
    
    // ===== ACADEMY ASSOCIATION =====
    academies: [{
      academy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SportsAcademy',
      },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED', 'ACTIVE', 'INACTIVE'],
        default: 'PENDING',
      },
      joinedAt: { type: Date, default: Date.now },
      removedAt: Date,
    }],
    
    // ===== SPORTS SPECIALIZATION =====
    // Made more flexible - can accept simple strings or objects
    specialization: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },
    
    // ===== QUALIFICATIONS =====
    qualifications: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    
    // ===== CERTIFICATIONS =====
    // Made more flexible - can accept simple strings or objects
    certifications: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },
    
    // ===== EXPERIENCE =====
    totalExperience: {
      type: Number,
      min: 0,
      default: 0
    },
    previousExperience: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    
    // ===== BIO =====
    bio: {
      type: String,
      maxlength: 1000,
      default: ''
    },
    
    // ===== AVAILABILITY =====
    availability: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'WEEKENDS_ONLY', 'FLEXIBLE'],
      default: 'FLEXIBLE'
    },
    
    // ===== PRICING (For Freelancers) =====
    pricing: {
      hourlyRate: {
        type: Number,
        min: 0
      },
      sessionRate: {
        type: Number,
        min: 0
      },
      packageRates: [
        {
          sessions: Number,
          price: Number,
          description: String
        }
      ],
      currency: {
        type: String,
        default: 'INR'
      }
    },
    
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
      enum: [
        'PENDING',
        'PENDING_ACADEMY_APPROVAL',
        'PENDING_SUPER_ADMIN_APPROVAL',
        'APPROVED',
        'REJECTED',
        'SUSPENDED'
      ],
      default: 'PENDING'
    },
    
    // ===== APPROVAL TRACKING =====
    academyApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    academyApprovedAt: Date,
    
    superAdminApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    superAdminApprovedAt: Date,
    
    rejectionReason: String,
    
    // ===== RATINGS & REVIEWS =====
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
    
    // ===== STATISTICS =====
    totalStudentsTaught: {
      type: Number,
      default: 0
    },
    totalSessionsConducted: {
      type: Number,
      default: 0
    },
    
    // ===== SETTINGS =====
    isActive: {
      type: Boolean,
      default: true
    },
    isAvailableForBooking: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    
    // ===== ADDITIONAL INFO =====
    languages: [String],
    /** Stored as { title, description, year } after profile updates; legacy docs may still have plain strings. */
    achievements: [mongoose.Schema.Types.Mixed],
    
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
coachSchema.index({ status: 1, coachType: 1 });
coachSchema.index({ academies: 1, status: 1 });
coachSchema.index({ averageRating: -1 });

// ===== VIRTUALS =====
coachSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// ===== METHODS =====
coachSchema.methods.isApproved = function() {
  return this.status === 'APPROVED';
};

coachSchema.methods.needsAcademyApproval = function() {
  return (this.coachType === 'ACADEMY_COACH' || this.coachType === 'BOTH') && 
         this.status === 'PENDING_ACADEMY_APPROVAL';
};

coachSchema.methods.needsSuperAdminApproval = function() {
  return this.status === 'PENDING_SUPER_ADMIN_APPROVAL' || 
         (this.coachType === 'FREELANCER' && this.status === 'PENDING');
};

// Enable virtuals in JSON
coachSchema.set('toJSON', { virtuals: true });
coachSchema.set('toObject', { virtuals: true });

const Coach = mongoose.model('Coach', coachSchema);

export default Coach;