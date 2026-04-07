import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  // If member is a registered user
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Role in the team
  role: {
    type: String,
    default: 'player'
  },
  // Member details (required for non-registered users or if sport requires these)
  name: {
    type: String,
    required: true
  },
  email: String,
  phone: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: ''
  },
  // Sport-specific details
  position: String,
  jerseyNumber: Number,
  photo: String,
  idProof: String,
  // Link back to academy player pool
  poolPlayerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  // Status
  joinedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'active'
  }
}, { _id: true });

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  sport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sport',
    required: true
  },
  // Legacy field for backward compatibility
  sportName: String,
  // Academy that owns this team (if academy-created)
  academy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SportsAcademy',
    default: null
  },
  // Event this team is registered for (if event-specific team)
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  // Is this a permanent team or event-specific
  teamType: {
    type: String,
    enum: ['permanent', 'event_specific'],
    default: 'event_specific'
  },
  // Age category
  ageCategory: {
    type: String,
    enum: ['open', 'u-7', 'u-9', 'u-11', 'u-13', 'u-14', 'u-16', 'u-17', 'u-19', 'u-21', 'u-23', 'u-25', 'senior', 'veteran'],
    default: 'open'
  },
  // Game format
  gameFormat: {
    type: String,
    enum: ['individual', 'doubles', 'team', 'mixed_doubles'],
    default: 'team'
  },
  // Gender category
  genderCategory: {
    type: String,
    enum: ['male', 'female', 'mixed'],
    default: 'male'
  },
  // Player limits
  maxPlayers: {
    type: Number,
    default: 0
  },
  minPlayers: {
    type: Number,
    default: 0
  },
  maxSubstitutes: {
    type: Number,
    default: 0
  },
  // Playing eleven / starting lineup size
  playingSize: {
    type: Number,
    default: 0
  },
  // Coach / manager info
  coachName: {
    type: String,
    default: ''
  },
  managerName: {
    type: String,
    default: ''
  },
  // Uniform / kit details
  primaryColor: {
    type: String,
    default: ''
  },
  secondaryColor: {
    type: String,
    default: ''
  },
  // Training schedule
  trainingSchedule: {
    type: String,
    default: ''
  },
  // Entry / registration fee
  entryFee: {
    type: Number,
    default: 0
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // members: [{
  //   player: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'User'
  //   },
  //   role: {
  //     type: String,
  //     enum: ['captain', 'vice_captain', 'player', 'substitute'],
  //     default: 'player'
  //   },
  //   jerseyNumber: Number,
  //   position: String,
  //   joinedAt: {
  //     type: Date,
  //     default: Date.now
  //   },
  //   status: {
  //     type: String,
  //     enum: ['active', 'inactive', 'suspended'],
  //     default: 'active'
  //   }
  // }],
    viceCaptain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Team members with their details
  members: [teamMemberSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    city: String,
    state: String,
    country: String
  },
  contactEmail: String,
  contactPhone: String,
  socialLinks: {
    facebook: String,
    twitter: String,
    instagram: String
  },
  achievements: [{
    title: String,
    description: String,
    date: Date,
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    }
  }],
  stats: {
    totalMatches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  },
  eventsParticipated: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    result: String,
    position: Number,
    participatedAt: Date
  }],
   registrationStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  // Payment status for event registration
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentDetails: {
    amount: Number,
    currency: String,
    transactionId: String,
    paidAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
teamSchema.index({ name: 'text' });
teamSchema.index({ sport: 1 });
teamSchema.index({ event: 1 });
teamSchema.index({ captain: 1 });
teamSchema.index({ createdBy: 1 });
teamSchema.index({ academy: 1 });
teamSchema.index({ 'location.city': 1 });
teamSchema.index({ registrationStatus: 1 });

// Virtual for member count
teamSchema.virtual('memberCount').get(function() {
  return this.members && Array.isArray(this.members) ? this.members.length : 0;
});
// Virtual to get captain details
teamSchema.virtual('captainDetails').get(function() {
  return this.members && Array.isArray(this.members) ? this.members.find(m => m.role === 'captain') : null;
});

// Virtual to get vice captain details
teamSchema.virtual('viceCaptainDetails').get(function() {
  return this.members && Array.isArray(this.members) ? this.members.find(m => m.role === 'vice_captain') : null;
});

// Virtual for playing members
teamSchema.virtual('playingMembers').get(function() {
  return this.members && Array.isArray(this.members) ? this.members.filter(m => m.role !== 'substitute' && m.status === 'active') : [];
});

// Virtual for substitutes
teamSchema.virtual('substitutes').get(function() {
  return this.members && Array.isArray(this.members) ? this.members.filter(m => m.role === 'substitute' && m.status === 'active') : [];
});

teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

const Team = mongoose.model('Team', teamSchema);

export default Team;
