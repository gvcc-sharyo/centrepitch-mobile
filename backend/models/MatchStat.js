import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["team", "player"],
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const matchStatSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    participant: participantSchema,
    teamTotals: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    playerStats: [
      {
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: {
          type: String,
          default: "",
        },
        stats: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    timeline: [
      {
        minute: Number,
        type: String,
        actor: String,
        note: String,
      },
    ],
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

matchStatSchema.index(
  { event: 1, matchId: 1, "participant.type": 1, "participant.refId": 1 },
  { unique: true }
);

const MatchStat = mongoose.model("MatchStat", matchStatSchema);

export default MatchStat;
