import mongoose from "mongoose";

const { Schema } = mongoose;

const eventTeamRegistrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },

    registrationDate: { type: Date, default: Date.now, index: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "refunded", "failed"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["registered", "confirmed", "disqualified", "withdrawn"],
      default: "registered",
      index: true,
    },

    registeredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    withdrawnAt: { type: Date, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// One registration record per team per event.
eventTeamRegistrationSchema.index({ event: 1, team: 1 }, { unique: true });
eventTeamRegistrationSchema.index({ event: 1, status: 1, registrationDate: -1 });

const EventTeamRegistration = mongoose.model("EventTeamRegistration", eventTeamRegistrationSchema);

export default EventTeamRegistration;

