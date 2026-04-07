import mongoose from "mongoose";

const { Schema } = mongoose;

const eventPairInviteSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    inviter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    partner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "expired"],
      default: "pending",
      index: true,
    },
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", default: null },

    message: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now, index: true },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Prevent duplicates while pending.
eventPairInviteSchema.index(
  { event: 1, inviter: 1, partner: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

eventPairInviteSchema.index({ partner: 1, status: 1, createdAt: -1 });

const EventPairInvite = mongoose.model("EventPairInvite", eventPairInviteSchema);

export default EventPairInvite;

