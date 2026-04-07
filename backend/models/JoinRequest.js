import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
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
    rejectionReason: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
  },
  { timestamps: true },
);

joinRequestSchema.index({ coach: 1, academy: 1, status: 1 });
joinRequestSchema.index({ academy: 1, status: 1 });

const JoinRequest = mongoose.model("JoinRequest", joinRequestSchema);

export default JoinRequest;
