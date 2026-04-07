import mongoose from "mongoose";

const { Schema } = mongoose;

const eventPlayerRegistrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    player: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // For doubles registrations: both players share the same pairGroupId.
    pairGroupId: { type: Schema.Types.ObjectId, default: null, index: true },
    partner: { type: Schema.Types.ObjectId, ref: "User", default: null },

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

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** User who completed event registration payment (for doubles, same id on both partner rows). */
    paymentCompletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    withdrawnAt: { type: Date, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// One active registration record per player per event.
eventPlayerRegistrationSchema.index({ event: 1, player: 1 }, { unique: true });
eventPlayerRegistrationSchema.index({ event: 1, status: 1, registrationDate: -1 });

const EventPlayerRegistration = mongoose.model(
  "EventPlayerRegistration",
  eventPlayerRegistrationSchema
);

export default EventPlayerRegistration;

