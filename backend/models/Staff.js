import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Staff name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String
  },
  experience: {
    years: Number,
    description: String
  },
  certifications: [{
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date,
    document: String
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SportsAcademy',
    default: null
  },
  events: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    role: String,
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['assigned', 'confirmed', 'declined', 'completed'],
      default: 'assigned'
    }
  }],
  profilePhoto: String,
  address: {
    city: String,
    state: String,
    country: String
  },
  availability: {
    type: String,
    enum: ['available', 'busy', 'unavailable'],
    default: 'available'
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  linkedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
staffSchema.index({ addedBy: 1, role: 1 });
staffSchema.index({ email: 1 });

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
