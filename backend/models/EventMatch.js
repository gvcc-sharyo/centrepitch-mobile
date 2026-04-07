import mongoose from "mongoose";

const { Schema } = mongoose;

const sideSchema = new Schema(
  {
    entityType: { type: String, enum: ["team", "player", "pair"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  },
  { _id: false }
);

const eventMatchSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    round: { type: String, required: true, index: true },
    matchNumber: { type: Number, default: null },

    sideA: { type: sideSchema, required: true },
    sideB: { type: sideSchema, required: true },

    scheduledAt: { type: Date, default: null, index: true },
    venue: { type: String, default: "" },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    result: {
      winnerType: { type: String, enum: ["team", "player", "pair"], default: null },
      winnerId: { type: Schema.Types.ObjectId, default: null },
      score: { type: String, default: "" },
      notes: { type: String, default: "" },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

eventMatchSchema.index({ event: 1, round: 1, matchNumber: 1 });
eventMatchSchema.index({ event: 1, status: 1, scheduledAt: 1 });

const EventMatch = mongoose.model("EventMatch", eventMatchSchema);

export default EventMatch;

