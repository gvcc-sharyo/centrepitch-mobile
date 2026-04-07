import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    academies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SportsAcademy',
      },
    ],
    name: {
      type: String,
      required: [true, 'Player name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    position: {
      type: String,
      trim: true,
      default: '',
    },
    jerseyNumber: {
      type: Number,
      default: null,
    },
    sports: [
      {
        sport: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Sport',
          required: true,
        },
        sportName: { type: String, default: '' },
        position: { type: String, trim: true, default: '' },
        jerseyNumber: { type: Number, default: null },
        level: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced', 'professional', ''],
          default: '',
        },
      },
    ],
    analyticsProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    analyticsUpdatedAt: {
      type: Date,
      default: null,
    },
    photo: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending'],
      default: 'active',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

playerSchema.index({ academies: 1, status: 1 });
playerSchema.index({ academies: 1, name: 1 });
playerSchema.index({ academies: 1, isActive: 1, createdAt: -1 });
playerSchema.index({ user: 1 }, { unique: true, sparse: true });
playerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $ne: '' } } }
);

const Player = mongoose.model('Player', playerSchema);

export default Player;
