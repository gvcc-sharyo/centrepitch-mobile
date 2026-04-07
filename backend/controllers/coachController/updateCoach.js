import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import {
  DUPLICATE_EMAIL_MESSAGE,
  DUPLICATE_PHONE_MESSAGE,
} from "../../constants/contactErrors.js";

const normalizeCoachAchievements = (raw) => {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string") {
      const s = String(item).trim();
      if (!s) continue;
      if ((s.startsWith("[") || s.startsWith("{")) && s.length > 2) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            for (const el of parsed) {
              const n = normalizeCoachAchievements([el])[0];
              if (n) out.push(n);
            }
            continue;
          }
          if (parsed && typeof parsed === "object") {
            const title = String(parsed.title || "").trim();
            if (!title) continue;
            out.push({
              title,
              description: String(parsed.description || "").trim(),
              year: parsed.year != null ? String(parsed.year).trim() : "",
            });
            continue;
          }
        } catch {
          // treat as plain title string
        }
      }
      out.push({ title: s, description: "", year: "" });
      continue;
    }
    if (typeof item === "object") {
      const title = String(item.title ?? "").trim();
      if (!title) continue;
      out.push({
        title,
        description: String(item.description ?? "").trim(),
        year: item.year != null ? String(item.year).trim() : "",
      });
    }
  }
  return out;
};

/**
 * @desc    Update coach profile
 * @route   PUT /api/coaches/:id
 * @access  Private/Coach (own) or SuperAdmin
 */
export const updateCoach = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Coach can only update their own profile
    if (
      req.user.role === "coach" &&
      coach.userId &&
      coach.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const {
      email,
      phone,
      bio,
      dateOfBirth,
      coachType,
      specialization,
      qualifications,
      certifications,
      availability,
      pricing,
      languages,
      achievements,
      previousExperience,
      profilePhoto,
    } = req.body;

    const normalizedEmail = email !== undefined ? String(email || "").trim().toLowerCase() : undefined;
    const normalizedPhone = phone !== undefined ? String(phone || "").trim() : undefined;

    if (normalizedEmail !== undefined) {
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }
      const duplicateUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: coach.userId },
      });
      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
      coach.email = normalizedEmail;
    }

    if (normalizedPhone !== undefined) {
      const duplicatePhoneUser = normalizedPhone
        ? await User.findOne({
            phone: normalizedPhone,
            _id: { $ne: coach.userId },
          })
        : null;

      if (duplicatePhoneUser) {
        return res.status(409).json({
          success: false,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
      coach.phone = normalizedPhone;
    }

    if (dateOfBirth !== undefined) {
      const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;
      if (!parsedDob || Number.isNaN(parsedDob.getTime())) {
        return res.status(400).json({
          success: false,
          code: "INVALID_DATE_OF_BIRTH",
          message: "Valid date of birth is required",
        });
      }
      coach.dateOfBirth = parsedDob;
    }

    if (coachType !== undefined) {
      const normalizedCoachType = String(coachType || "").trim().toUpperCase();
      const allowedCoachTypes = ["FREELANCER", "ACADEMY_COACH", "BOTH"];
      if (!allowedCoachTypes.includes(normalizedCoachType)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_COACH_TYPE",
          message: "Coach type must be FREELANCER, ACADEMY_COACH, or BOTH",
        });
      }
      coach.coachType = normalizedCoachType;
    }

    if (req.user.role === "coach") {
      const hasDob = Boolean(coach.dateOfBirth);
      const hasCoachType = Boolean(String(coach.coachType || "").trim());
      if (!hasDob || !hasCoachType) {
        return res.status(400).json({
          success: false,
          code: "COACH_PROFILE_INCOMPLETE",
          message: "Complete coach setup first (date of birth and coach type are required)",
        });
      }
    }

    if (bio !== undefined) coach.bio = bio;
    if (specialization !== undefined) coach.specialization = specialization;
    if (qualifications !== undefined) coach.qualifications = qualifications;
    if (certifications !== undefined) coach.certifications = certifications;
    if (availability !== undefined) coach.availability = availability;
    if (pricing !== undefined && coach.coachType !== "ACADEMY_COACH") coach.pricing = pricing;
    if (languages !== undefined) coach.languages = languages;
    if (achievements !== undefined) coach.achievements = normalizeCoachAchievements(achievements);
    if (previousExperience !== undefined) coach.previousExperience = previousExperience;
    if (profilePhoto !== undefined) coach.profilePhoto = profilePhoto;

    if (coach.userId && (normalizedEmail !== undefined || normalizedPhone !== undefined)) {
      const linkedUser = await User.findById(coach.userId);
      if (linkedUser) {
        if (normalizedEmail !== undefined && linkedUser.email !== normalizedEmail) {
          linkedUser.email = normalizedEmail;
          linkedUser.isEmailVerified = false;
          linkedUser.isVerified = false;
          linkedUser.emailOtp = undefined;
          linkedUser.emailOtpExpire = undefined;
          linkedUser.otp = undefined;
          linkedUser.otpExpire = undefined;
        }
        if (normalizedPhone !== undefined && linkedUser.phone !== normalizedPhone) {
          linkedUser.phone = normalizedPhone;
          linkedUser.isPhoneVerified = false;
          linkedUser.phoneOtp = undefined;
          linkedUser.phoneOtpExpire = undefined;
        }
        await linkedUser.save();
      }
    }

    await coach.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: coach,
    });
  } catch (error) {
    console.error("Update coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};