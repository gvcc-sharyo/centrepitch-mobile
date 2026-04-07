import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    eventPublishPricing: {
      baseAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      gstPercent: {
        type: Number,
        default: 18,
        min: 0,
        max: 100
      },
      currency: {
        type: String,
        default: 'INR'
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    eventPublishPricingHistory: [{
      previous: {
        baseAmount: { type: Number, default: 0 },
        gstPercent: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' }
      },
      next: {
        baseAmount: { type: Number, default: 0 },
        gstPercent: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' }
      },
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      note: {
        type: String,
        default: ''
      },
      changedAt: {
        type: Date,
        default: Date.now
      }
    }],
    sportPublishPricing: [{
      sport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sport',
        required: true
      },
      baseAmount: {
        type: Number,
        default: 0,
        min: 0
      },
      gstPercent: {
        type: Number,
        default: 18,
        min: 0,
        max: 100
      },
      currency: {
        type: String,
        default: 'INR'
      },
      isActive: {
        type: Boolean,
        default: true
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

platformSettingsSchema.statics.getActiveSettings = async function getActiveSettings() {
  let settings = await this.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
