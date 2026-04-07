import mongoose from "mongoose";

const playerJoinRequestSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    message: {
      type: String,
      default: "",
    },
    sports: [
      {
        sport: { type: mongoose.Schema.Types.ObjectId, ref: "UserSport" },
        sportName: String,
        position: String,
        level: String,
      },
    ],
    rejectionReason: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
  },
  { timestamps: true }
);

playerJoinRequestSchema.index({ player: 1, academy: 1, status: 1 });
playerJoinRequestSchema.index({ academy: 1, status: 1 });
playerJoinRequestSchema.index({ user: 1 });

const PlayerJoinRequest = mongoose.model("PlayerJoinRequest", playerJoinRequestSchema);

export default PlayerJoinRequest;
