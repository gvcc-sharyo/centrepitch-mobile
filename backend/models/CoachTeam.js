import mongoose from "mongoose";

const coachTeamMemberSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },
  role: {
    type: String,
    default: "player",
  },
  name: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  position: { type: String, default: "" },
  jerseyNumber: { type: Number, default: null },
  gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
  dateOfBirth: { type: Date, default: null },
  joinedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    default: "active",
  },
}, { _id: true });

const coachTeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
    },
    description: { type: String, default: "" },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSport",
      required: true,
    },
    sportName: { type: String, default: "" },
    logo: { type: String, default: "" },

    teamType: {
      type: String,
      enum: ["permanent", "event_specific"],
      default: "permanent",
    },
    ageCategory: {
      type: String,
      enum: ["open", "u-7", "u-9", "u-11", "u-13", "u-14", "u-16", "u-17", "u-19", "u-21", "u-23", "u-25", "senior", "veteran"],
      default: "open",
    },
    gameFormat: {
      type: String,
      enum: ["individual", "doubles", "team", "mixed_doubles"],
      default: "team",
    },
    genderCategory: {
      type: String,
      enum: ["male", "female", "mixed"],
      default: "male",
    },

    maxPlayers: { type: Number, default: 0 },
    minPlayers: { type: Number, default: 0 },
    maxSubstitutes: { type: Number, default: 0 },
    playingSize: { type: Number, default: 0 },

    coachName: { type: String, default: "" },
    managerName: { type: String, default: "" },

    primaryColor: { type: String, default: "#1e40af" },
    secondaryColor: { type: String, default: "#ffffff" },

    trainingSchedule: { type: String, default: "" },
    entryFee: { type: Number, default: 0 },

    location: {
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },

    members: [coachTeamMemberSchema],

    // Keep legacy players array for backward compat during transition
    players: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
        joinedAt: { type: Date, default: Date.now },
        role: { type: String, enum: ["member", "captain", "vice_captain"], default: "member" },
      },
    ],

    maxSize: { type: Number, default: 20 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

coachTeamSchema.index({ coach: 1, status: 1 });
coachTeamSchema.index({ "members.player": 1 });
coachTeamSchema.index({ "players.player": 1 });
coachTeamSchema.index({ sport: 1 });

coachTeamSchema.virtual("memberCount").get(function () {
  return this.members ? this.members.length : 0;
});

coachTeamSchema.virtual("captainDetails").get(function () {
  return this.members ? this.members.find((m) => m.role === "captain") : null;
});

coachTeamSchema.set("toJSON", { virtuals: true });
coachTeamSchema.set("toObject", { virtuals: true });

const CoachTeam = mongoose.model("CoachTeam", coachTeamSchema);

export default CoachTeam;
