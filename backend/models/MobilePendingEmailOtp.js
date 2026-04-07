import mongoose from "mongoose";

/**
 * Stores email OTP for mobile passwordless signup when no User row exists yet.
 * Web flows use /auth/register + /auth/send-otp on existing users only — this collection is mobile-only.
 */
const mobilePendingEmailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

mobilePendingEmailOtpSchema.index({ email: 1 }, { unique: true });
mobilePendingEmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("MobilePendingEmailOtp", mobilePendingEmailOtpSchema);
