import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'select', 'multiselect', 'checkbox', 'textarea'],
    required: true
  },
  options: [{
    type: String
  }],
  placeholder: String,
  required: {
    type: Boolean,
    default: false
  },
  unit: String,
  min: Number,
  max: Number,
  defaultValue: mongoose.Schema.Types.Mixed
}, { _id: false });

const sportTemplateSchema = new mongoose.Schema({
  sport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sport',
    required: true,
    unique: true
  },
  sportName: {
    type: String,
    required: true
  },
  sportSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  category: {
    type: String,
    enum: [
      'team_sports',
      'racket_sports', 
      'water_sports',
      'combat_sports',
      'target_sports',
      'fitness',
      'indoor_games',
      'skating_cycling',
      'outdoor_adventure',
      'esports',
      'other'
    ],
    default: 'other'
  },
  fields: [fieldSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

sportTemplateSchema.index({ category: 1 });
sportTemplateSchema.index({ isActive: 1 });

sportTemplateSchema.statics.getTemplateBySportId = async function(sportId) {
  return this.findOne({ sport: sportId, isActive: true });
};

sportTemplateSchema.statics.getTemplateBySlug = async function(slug) {
  return this.findOne({ sportSlug: slug, isActive: true });
};

const SportTemplate = mongoose.model('SportTemplate', sportTemplateSchema);

export default SportTemplate;
