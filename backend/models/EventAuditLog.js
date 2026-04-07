import mongoose from "mongoose";

const { Schema } = mongoose;

const eventAuditLogSchema = new Schema(
  {
    entityType: {
      type: String,
      enum: [
        "event_player_registration",
        "event_team_registration",
        "event_pair_invite",
        "event_match",
      ],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },

    action: { type: String, required: true, index: true }, // e.g. created/updated/withdrawn/accepted/rejected
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

eventAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
eventAuditLogSchema.index({ actor: 1, createdAt: -1 });

const EventAuditLog = mongoose.model("EventAuditLog", eventAuditLogSchema);

export default EventAuditLog;

