import mongoose from 'mongoose';

const courtSubscriptionPlanSchema = new mongoose.Schema(
  {
    // ===== BASIC INFORMATION =====
    name: {
      type: String,
      required: [true, 'Plan name is required'],
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

    // ===== APPLICABLE COURTS =====
    applicableCourts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court'
    }],
    applyToAllCourts: {
      type: Boolean,
      default: false
    },

    // ===== DURATION =====
    durationMonths: {
      type: Number,
      required: [true, 'Duration in months is required'],
      min: 1,
      max: 24
    },

    // ===== SESSION CONFIGURATION =====
    sessionConfig: {
      maxHoursPerSession: {
        type: Number,
        required: true,
        min: 0.5,
        default: 2
      },
      sessionsPerWeek: {
        type: Number,
        default: null
      },
      sessionsPerMonth: {
        type: Number,
        default: null
      },
      totalSessionsInPlan: {
        type: Number,
        default: null
      }
    },

    // ===== TIME RESTRICTIONS =====
    timeRestrictions: {
      allowedDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      allowedTimeStart: {
        type: String,
        default: '06:00'
      },
      allowedTimeEnd: {
        type: String,
        default: '22:00'
      },
      excludePeakHours: {
        type: Boolean,
        default: false
      },
      peakHoursStart: String,
      peakHoursEnd: String
    },

    // ===== PRICING =====
    pricing: {
      basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: 0
      },
      discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      discountedPrice: {
        type: Number,
        default: 0
      },
      currency: {
        type: String,
        default: 'INR'
      }
    },

    // ===== GST & TAX =====
    tax: {
      gstPercent: {
        type: Number,
        default: 18,
        min: 0,
        max: 100
      },
      gstInclusive: {
        type: Boolean,
        default: false
      },
      gstAmount: {
        type: Number,
        default: 0
      },
      totalAmount: {
        type: Number,
        default: 0
      }
    },

    // ===== BOOKING RULES =====
    bookingRules: {
      advanceBookingDays: {
        type: Number,
        default: 7,
        min: 1
      },
      cancellationHours: {
        type: Number,
        default: 24
      },
      allowRescheduling: {
        type: Boolean,
        default: true
      },
      maxReschedules: {
        type: Number,
        default: 2
      }
    },

    // ===== PLAN LIMITS =====
    limits: {
      maxSubscribers: {
        type: Number,
        default: null
      },
      currentSubscribers: {
        type: Number,
        default: 0
      }
    },

    // ===== FEATURES & BENEFITS =====
    features: [{
      type: String
    }],

    // ===== AUTO-RENEWAL =====
    autoRenewal: {
      enabled: {
        type: Boolean,
        default: false
      },
      reminderDays: {
        type: Number,
        default: 7
      }
    },

    // ===== VALIDITY =====
    validity: {
      startDate: {
        type: Date,
        default: null
      },
      endDate: {
        type: Date,
        default: null
      },
      isAlwaysAvailable: {
        type: Boolean,
        default: true
      }
    },

    // ===== STATUS =====
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'],
      default: 'DRAFT'
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
    sortOrder: {
      type: Number,
      default: 0
    },

    // ===== STATISTICS =====
    stats: {
      totalSubscriptions: {
        type: Number,
        default: 0
      },
      activeSubscriptions: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

// ===== INDEXES =====
courtSubscriptionPlanSchema.index({ academy: 1, status: 1 });
courtSubscriptionPlanSchema.index({ academy: 1, isActive: 1 });
courtSubscriptionPlanSchema.index({ status: 1, isActive: 1 });

// ===== PRE-SAVE MIDDLEWARE =====
courtSubscriptionPlanSchema.pre('save', function(next) {
  // Calculate discounted price
  if (this.pricing.discountPercent > 0) {
    this.pricing.discountedPrice = this.pricing.basePrice * (1 - this.pricing.discountPercent / 100);
  } else {
    this.pricing.discountedPrice = this.pricing.basePrice;
  }

  // Calculate GST and total
  const priceForTax = this.pricing.discountedPrice || this.pricing.basePrice;
  
  if (this.tax.gstInclusive) {
    this.tax.gstAmount = priceForTax - (priceForTax / (1 + this.tax.gstPercent / 100));
    this.tax.totalAmount = priceForTax;
  } else {
    this.tax.gstAmount = priceForTax * (this.tax.gstPercent / 100);
    this.tax.totalAmount = priceForTax + this.tax.gstAmount;
  }

  // Round to 2 decimal places
  this.pricing.discountedPrice = Math.round(this.pricing.discountedPrice * 100) / 100;
  this.tax.gstAmount = Math.round(this.tax.gstAmount * 100) / 100;
  this.tax.totalAmount = Math.round(this.tax.totalAmount * 100) / 100;

  next();
});

// ===== METHODS =====
courtSubscriptionPlanSchema.methods.isAvailableForSubscription = function() {
  if (!this.isActive || this.status !== 'ACTIVE') return false;
  
  if (this.limits.maxSubscribers && this.limits.currentSubscribers >= this.limits.maxSubscribers) {
    return false;
  }

  if (!this.validity.isAlwaysAvailable) {
    const now = new Date();
    if (this.validity.startDate && now < this.validity.startDate) return false;
    if (this.validity.endDate && now > this.validity.endDate) return false;
  }

  return true;
};

courtSubscriptionPlanSchema.methods.getPriceBreakdown = function() {
  return {
    basePrice: this.pricing.basePrice,
    discountPercent: this.pricing.discountPercent,
    discountAmount: this.pricing.basePrice - this.pricing.discountedPrice,
    subtotal: this.pricing.discountedPrice,
    gstPercent: this.tax.gstPercent,
    gstAmount: this.tax.gstAmount,
    gstInclusive: this.tax.gstInclusive,
    total: this.tax.totalAmount,
    currency: this.pricing.currency
  };
};

// ===== STATIC METHODS =====
courtSubscriptionPlanSchema.statics.getActiveByAcademy = async function(academyId) {
  return await this.find({
    academy: academyId,
    isActive: true,
    status: 'ACTIVE'
  })
    .populate('applicableCourts', 'name sportType courtType')
    .sort({ sortOrder: 1, createdAt: -1 });
};

courtSubscriptionPlanSchema.statics.getAllByAcademy = async function(academyId) {
  return await this.find({ academy: academyId })
    .populate('applicableCourts', 'name sportType courtType')
    .sort({ sortOrder: 1, createdAt: -1 });
};

const CourtSubscriptionPlan = mongoose.model('CourtSubscriptionPlan', courtSubscriptionPlanSchema);

export default CourtSubscriptionPlan;
