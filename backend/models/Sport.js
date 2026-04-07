// import mongoose from 'mongoose';

// const sportSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: [true, 'Sport name is required'],
//     trim: true,
//     unique: true
//   },
//   slug: {
//     type: String,
//     unique: true,
//     lowercase: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   icon: {
//     type: String, // URL to icon or icon class name
//     default: ''
//   },
//   image: {
//     type: String, // Cover image for the sport
//     default: ''
//   },

//   // Game format types - multiple can be enabled
//   formats: {
//     individual: {
//       enabled: { type: Boolean, default: false },
//       minPlayers: { type: Number, default: 1 },
//       maxPlayers: { type: Number, default: 1 },
//       description: String
//     },
//     doubles: {
//       enabled: { type: Boolean, default: false },
//       minPlayers: { type: Number, default: 2 },
//       maxPlayers: { type: Number, default: 2 },
//       description: String
//     },
//     team: {
//       enabled: { type: Boolean, default: false },
//       minPlayersPerTeam: { type: Number, default: 5 },
//       maxPlayersPerTeam: { type: Number, default: 15 },
//       playingCount: { type: Number, default: 11 }, // Players on field at a time
//       substitutesCount: { type: Number, default: 4 }, // Max substitutes allowed
//       description: String
//     }
//   },

//   // Team configuration (when team format is enabled)
//   teamSettings: {
//     requiresCaptain: { type: Boolean, default: true },
//     requiresViceCaptain: { type: Boolean, default: true },
//     captainCanPlay: { type: Boolean, default: true },
//     // Required fields for team members
//     memberRequiredFields: [{
//       type: String,
//       enum: ['name', 'email', 'phone', 'dateOfBirth', 'gender', 'position', 'jerseyNumber', 'photo', 'idProof']
//     }],
//     // Positions available for this sport (e.g., Goalkeeper, Striker, etc.)
//     positions: [String],
//     // Jersey number range
//     jerseyNumberRange: {
//       min: { type: Number, default: 1 },
//       max: { type: Number, default: 99 }
//     }
//   },

//   // Categories/Divisions
//   categories: [{
//     name: { type: String, required: true }, // e.g., "Under-19", "Senior", "Women"
//     code: String, // e.g., "U19", "SR", "W"
//     minAge: Number,
//     maxAge: Number,
//     gender: {
//       type: String,
//       enum: ['male', 'female', 'mixed', 'any'],
//       default: 'any'
//     },
//     description: String,
//     isActive: { type: Boolean, default: true }
//   }],

//   // Scoring system information
//   scoringSystem: {
//     type: {
//       type: String,
//       enum: ['points', 'goals', 'runs', 'sets', 'games', 'time', 'other'],
//       default: 'points'
//     },
//     description: String,
//     winCondition: String // e.g., "Highest score wins", "Best of 3 sets"
//   },

//   // Match/Game settings
//   matchSettings: {
//     defaultDuration: { type: Number }, // in minutes
//     periods: { type: Number, default: 1 }, // e.g., 2 halves, 4 quarters
//     periodDuration: { type: Number }, // duration of each period in minutes
//     breakDuration: { type: Number }, // break between periods in minutes
//     overtimeAllowed: { type: Boolean, default: false },
//     tieBreaker: String // Description of tie-breaker rules
//   },

//   // Rules and regulations
//   rules: {
//     summary: String, // Brief rules summary
//     detailed: String, // Detailed rules (can be markdown)
//     documentUrl: String // Link to official rules document
//   },

//   // Equipment required
//   equipment: [{
//     name: String,
//     isRequired: { type: Boolean, default: true },
//     description: String
//   }],

//   // Venue requirements
//   venueRequirements: {
//     fieldType: String, // e.g., "Indoor court", "Grass field", "Swimming pool"
//     fieldDimensions: String, // e.g., "100m x 64m"
//     specialRequirements: [String]
//   },

//   // Popularity/Usage tracking
//   stats: {
//     eventsCount: { type: Number, default: 0 },
//     totalParticipants: { type: Number, default: 0 }
//   },

//   // Status
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   isFeatured: {
//     type: Boolean,
//     default: false
//   },

//   // Audit
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, {
//   timestamps: true
// });

// // Generate slug from name before saving
// sportSchema.pre('save', function(next) {
//   if (this.isModified('name')) {
//     this.slug = this.name
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/(^-|-$)/g, '');
//   }
//   next();
// });

// // Indexes
// sportSchema.index({ name: 'text', description: 'text' });
// sportSchema.index({ slug: 1 });
// sportSchema.index({ isActive: 1 });
// sportSchema.index({ isFeatured: 1 });

// // Virtual for getting enabled formats as array
// sportSchema.virtual('enabledFormats').get(function() {
//   const formats = [];
//   if (this.formats.individual.enabled) formats.push('individual');
//   if (this.formats.doubles.enabled) formats.push('doubles');
//   if (this.formats.team.enabled) formats.push('team');
//   return formats;
// });

// // Ensure virtuals are included in JSON
// sportSchema.set('toJSON', { virtuals: true });
// sportSchema.set('toObject', { virtuals: true });

// const Sport = mongoose.model('Sport', sportSchema);

// export default Sport;

import mongoose from 'mongoose';
 
const sportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Sport name is required'],
    trim: true
  },
  slug: {
    type: String,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String, // URL to icon or icon class name
    default: ''
  },
  image: {
    type: String, // Cover image for the sport
    default: ''
  },
 
  // Game format types - multiple can be enabled
  formats: {
    individual: {
      enabled: { type: Boolean, default: false },
      minPlayers: { type: Number, default: 1 },
      maxPlayers: { type: Number, default: 1 },
      description: String
    },
    doubles: {
      enabled: { type: Boolean, default: false },
      minPlayers: { type: Number, default: 2 },
      maxPlayers: { type: Number, default: 2 },
      description: String
    },
    team: {
      enabled: { type: Boolean, default: false },
      minPlayersPerTeam: { type: Number, default: 5 },
      maxPlayersPerTeam: { type: Number, default: 15 },
      playingCount: { type: Number, default: 11 }, // Players on field at a time
      substitutesCount: { type: Number, default: 4 }, // Max substitutes allowed
      description: String
    }
  },
 
  // Team configuration (when team format is enabled)
  teamSettings: {
    requiresCaptain: { type: Boolean, default: true },
    requiresViceCaptain: { type: Boolean, default: true },
    captainCanPlay: { type: Boolean, default: true },
    // Required fields for team members
    memberRequiredFields: [{
      type: String,
      enum: ['name', 'email', 'phone', 'dateOfBirth', 'gender', 'position', 'jerseyNumber', 'photo', 'idProof']
    }],
    // Positions available for this sport (e.g., Goalkeeper, Striker, etc.)
    positions: [String],
    // Jersey number range
    jerseyNumberRange: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 99 }
    },
    // Squad role & status labels for academy/coach team UIs (optional; defaults used when empty)
    memberRoles: [{
      value: { type: String, required: true },
      label: { type: String, required: true },
      tone: { type: String, default: 'blue' },
      order: { type: Number, default: 0 },
      leadership: { type: Boolean, default: false },
    }],
    memberStatuses: [{
      value: { type: String, required: true },
      label: { type: String, required: true },
      tone: { type: String, default: 'emerald' },
      order: { type: Number, default: 0 },
    }],
  },
 
  // Category configuration - defines what fields are available for categories
  categorySettings: {
    // Available fields that can be configured for each category
    availableFields: [{
      fieldName: { type: String, required: true }, // e.g., 'ageGroup', 'skillLevel', 'weight'
      fieldLabel: { type: String, required: true }, // Display label e.g., 'Age Group'
      fieldType: { 
        type: String, 
        enum: ['text', 'number', 'select', 'range', 'boolean'],
        default: 'text'
      },
      options: [String], // For select type - available options
      rangeConfig: { // For range type (like age range, weight range)
        minLabel: { type: String, default: 'Min' },
        maxLabel: { type: String, default: 'Max' },
        unit: String // e.g., 'years', 'kg'
      },
      isRequired: { type: Boolean, default: false },
      order: { type: Number, default: 0 }
    }],
    // Predefined category templates
    useGender: { type: Boolean, default: true },
    useAgeRange: { type: Boolean, default: true },
    useSkillLevel: { type: Boolean, default: false },
    useWeightClass: { type: Boolean, default: false }
  },
 
  // Categories/Divisions - now with dynamic fields
  categories: [{
    name: { type: String, required: true }, // e.g., "Under-19", "Senior", "Women"
    code: String, // e.g., "U19", "SR", "W"
    // Standard fields (controlled by categorySettings)
    minAge: Number,
    maxAge: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'mixed', 'any'],
      default: 'any'
    },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'professional', 'any'],
      default: 'any'
    },
    minWeight: Number,
    maxWeight: Number,
    weightUnit: { type: String, default: 'kg' },
    // Custom fields - stores dynamic field values
    customFields: mongoose.Schema.Types.Mixed,
    description: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  }],
 
  // Scoring system information
  scoringSystem: {
    type: {
      type: String,
      enum: ['points', 'goals', 'runs', 'sets', 'games', 'time', 'other'],
      default: 'points'
    },
    description: String,
    winCondition: String // e.g., "Highest score wins", "Best of 3 sets"
  },
 
  // Match/Game settings
  matchSettings: {
    defaultDuration: { type: Number }, // in minutes
    periods: { type: Number, default: 1 }, // e.g., 2 halves, 4 quarters
    periodDuration: { type: Number }, // duration of each period in minutes
    breakDuration: { type: Number }, // break between periods in minutes
    overtimeAllowed: { type: Boolean, default: false },
    tieBreaker: String // Description of tie-breaker rules
  },
 
  // Rules and regulations
  rules: {
    summary: String, // Brief rules summary
    detailed: String, // Detailed rules (can be markdown)
    documentUrl: String // Link to official rules document
  },
 
  // Equipment required
  equipment: [{
    name: String,
    isRequired: { type: Boolean, default: true },
    description: String
  }],
 
  // Venue requirements
  venueRequirements: {
    fieldType: String, // e.g., "Indoor court", "Grass field", "Swimming pool"
    fieldDimensions: String, // e.g., "100m x 64m"
    specialRequirements: [String]
  },
 
  // Popularity/Usage tracking
  stats: {
    eventsCount: { type: Number, default: 0 },
    totalParticipants: { type: Number, default: 0 }
  },
 
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  scope: {
    type: String,
    enum: ['system', 'user'],
    default: 'system'
  },
 
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});
 
// Generate slug from name before saving
sportSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});
 
// Indexes
sportSchema.index({ name: 'text', description: 'text' });
// Uniqueness rules:
// - System sports: slug must be unique within scope=system
// - User sports (organizer configs): slug must be unique per createdBy within scope=user
// This allows a user-owned config for an existing system sport name (e.g. "Badminton").
sportSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { scope: 'system' } }
);
sportSchema.index(
  { slug: 1, createdBy: 1 },
  { unique: true, partialFilterExpression: { scope: 'user' } }
);
sportSchema.index({ isActive: 1 });
sportSchema.index({ isFeatured: 1 });
sportSchema.index({ scope: 1, isActive: 1 });
sportSchema.index({ createdBy: 1, scope: 1 });
 
// Virtual for getting enabled formats as array
sportSchema.virtual('enabledFormats').get(function() {
  const formats = [];
  if (this.formats.individual.enabled) formats.push('individual');
  if (this.formats.doubles.enabled) formats.push('doubles');
  if (this.formats.team.enabled) formats.push('team');
  return formats;
});
 
// Ensure virtuals are included in JSON
sportSchema.set('toJSON', { virtuals: true });
sportSchema.set('toObject', { virtuals: true });
 
const Sport = mongoose.model('Sport', sportSchema);
 
export default Sport;