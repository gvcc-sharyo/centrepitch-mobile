import mongoose from "mongoose";

const sportConfigurationSchema = new mongoose.Schema(
  {
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Organizer-owned media overrides (optional).
    // If present, use these instead of the system Sport icon/image.
    icon: { type: String, default: "" },
    image: { type: String, default: "" },

    // Mirrors Sport config fields (but belongs to an organizer/user)
    formats: { type: Object, default: {} },
    teamSettings: { type: Object, default: {} },
    categorySettings: { type: Object, default: {} },
    categories: { type: Array, default: [] },
    scoringSystem: { type: Object, default: {} },
    matchSettings: { type: Object, default: {} },
    rules: { type: Object, default: {} },
    equipment: { type: Array, default: [] },
    venueRequirements: { type: Object, default: {} },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One configuration per organizer per sport
sportConfigurationSchema.index({ createdBy: 1, sport: 1 }, { unique: true });

const SportConfiguration = mongoose.model(
  "SportConfiguration",
  sportConfigurationSchema
);

export default SportConfiguration;

