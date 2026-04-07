import mongoose from "mongoose";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Coach from "../models/Coach.js";
import Player from "../models/Player.js";
import Sport from "../models/Sport.js";
import MobilePendingEmailOtp from "../models/MobilePendingEmailOtp.js";
import SportsAcademy from "../models/SportsAcademy.js";
import UserRoleSubscription from "../models/UserRoleSubscription.js";
import AuthAuditLog from "../models/AuthAuditLog.js";
import AuthSessionHistory from "../models/AuthSessionHistory.js";
import generateToken from "../utils/generateToken.js";
import sendEmail, { emailTemplates } from "../utils/sendEmail.js";
import sendPhoneOtp from "../utils/sendPhoneOtp.js";
import crypto from "crypto";
import {
  DUPLICATE_EMAIL_CODE,
  DUPLICATE_PHONE_CODE,
  DUPLICATE_EMAIL_MESSAGE,
  DUPLICATE_PHONE_MESSAGE,
} from "../constants/contactErrors.js";

const normalizeGoogleNames = ({ firstName = "", lastName = "", email = "" } = {}) => {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (first) return { firstName: first, lastName: last };
  const localPart = String(email || "").split("@")[0] || "User";
  return { firstName: localPart.trim() || "User", lastName: last };
};
const normalizePhone = (phone = "") => String(phone || "").trim();
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();
const normalizeOtp = (otp = "") => String(otp || "").trim();

const syncUserRoleSubscriptionSnapshot = async (user) => {
  if (!user?._id || !user?.roleRef) return;
  const now = new Date();

  await UserRoleSubscription.updateMany(
    {
      user: user._id,
      roleRef: user.roleRef,
      status: "active",
      expiresAt: { $lte: now },
    },
    { $set: { status: "expired", endedAt: now } }
  );

  let activeSub = await UserRoleSubscription.findOne({
    user: user._id,
    roleRef: user.roleRef,
    status: "active",
    expiresAt: { $gt: now },
  })
    .sort({ startsAt: -1, createdAt: -1 })
    .lean();

  if (!activeSub) {
    const queuedToActivate = await UserRoleSubscription.findOne({
      user: user._id,
      roleRef: user.roleRef,
      status: "queued",
      startsAt: { $lte: now },
    })
      .sort({ startsAt: 1, createdAt: 1 })
      .lean();

    if (queuedToActivate?._id) {
      await UserRoleSubscription.updateOne(
        { _id: queuedToActivate._id },
        {
          $set: {
            status: "active",
            activatedAt: now,
          },
        }
      );
      activeSub = { ...queuedToActivate, status: "active", activatedAt: now };
    }
  }

  if (activeSub) {
    user.subscriptionPlan = String(activeSub.planSlug || "").toLowerCase();
    user.subscriptionBillingCycle = String(activeSub.billingCycle || "monthly");
    user.subscriptionExpiry = activeSub.expiresAt || null;
    user.paymentStatus = "active";
    return;
  }

  const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  if (expiry && expiry <= now && String(user.paymentStatus || "").toLowerCase() === "active") {
    user.paymentStatus = "expired";
  }
};

const ensureCoachProfileForUser = async (user) => {
  if (!user?._id) return null;
  const normalizedEmail = normalizeEmail(user.email);
  let coach = await Coach.findOne({ userId: user._id });
  if (coach) return coach;

  if (normalizedEmail) {
    coach = await Coach.findOne({ email: normalizedEmail });
    if (coach) {
      if (!coach.userId) coach.userId = user._id;
      if (!coach.phone && user.phone) coach.phone = normalizePhone(user.phone);
      if (!coach.profilePhoto && user.profilePhoto) coach.profilePhoto = user.profilePhoto;
      coach.status = "APPROVED";
      await coach.save();
      return coach;
    }
  }

  const fallbackDob = user.dateOfBirth || new Date("2000-01-01T00:00:00.000Z");
  coach = await Coach.create({
    userId: user._id,
    firstName: String(user.firstName || "Coach").trim(),
    lastName: String(user.lastName || "User").trim(),
    email: normalizedEmail || `coach_${String(user._id)}@local.invalid`,
    phone: normalizePhone(user.phone),
    dateOfBirth: fallbackDob,
    profilePhoto: user.profilePhoto || null,
    status: "APPROVED",
    kycStatus: "INCOMPLETE",
  });
  return coach;
};

const TRIAL_ELIGIBLE_ROLES = ["organizer", "academyadmin", "coach"];
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const REQUIRE_PHONE_OTP_VERIFICATION =
  String(process.env.REQUIRE_PHONE_OTP_VERIFICATION || "false").toLowerCase() === "true";

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const setEmailOtp = (user) => {
  const otp = generateOtp();
  user.emailOtp = otp;
  user.emailOtpExpire = Date.now() + OTP_EXPIRY_MS;
  // Backward compatibility with existing fields
  user.otp = otp;
  user.otpExpire = user.emailOtpExpire;
  return otp;
};

const setPhoneOtp = (user) => {
  const otp = generateOtp();
  user.phoneOtp = otp;
  user.phoneOtpExpire = Date.now() + OTP_EXPIRY_MS;
  return otp;
};
const ensureEmailOtp = (user) => {
  const existing = normalizeOtp(user.emailOtp || user.otp);
  const valid =
    (existing && isNotExpired(user.emailOtpExpire)) ||
    (existing && isNotExpired(user.otpExpire));
  if (valid) return existing;
  return setEmailOtp(user);
};

const ensurePhoneOtp = (user) => {
  const existing = normalizeOtp(user.phoneOtp);
  if (existing && isNotExpired(user.phoneOtpExpire)) return existing;
  return setPhoneOtp(user);
};

const getEmailVerificationStatus = (user) =>
  typeof user.isEmailVerified === "boolean" ? user.isEmailVerified : Boolean(user.isVerified);

const getPhoneVerificationStatus = (user) =>
  typeof user.isPhoneVerified === "boolean" ? user.isPhoneVerified : Boolean(user.isVerified);

const isFullyVerified = (user) => getEmailVerificationStatus(user) && getPhoneVerificationStatus(user);
const isNotExpired = (value) => value && new Date(value).getTime() > Date.now();
const isAuthVerificationComplete = (user) =>
  getEmailVerificationStatus(user) &&
  (!REQUIRE_PHONE_OTP_VERIFICATION || getPhoneVerificationStatus(user));

const buildVerificationStatusPayload = (user) => ({
  email: user.email,
  phone: user.phone,
  emailVerified: getEmailVerificationStatus(user),
  phoneVerified: getPhoneVerificationStatus(user),
});

const ACTIVE_SESSION_EXISTS_CODE = "ACTIVE_SESSION_EXISTS";

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  if (typeof value === "number") return value === 1;
  return false;
};

const createSessionId = () => crypto.randomBytes(24).toString("hex");

const hasActiveSession = (user) =>
  Boolean(user?.activeSessionId && String(user.activeSessionId).trim());

const buildActiveSessionPayload = (user) => ({
  success: false,
  code: ACTIVE_SESSION_EXISTS_CODE,
  message:
    "You are already logged in on another system. Please confirm to logout there and continue here.",
  data: {
    role: user?.role || null,
  },
});

const getRequestMeta = (req) => {
  if (req._requestMeta) {
    return req._requestMeta;
  }

  const getHeader = (name) => {
    const value = req.headers?.[name];
    if (Array.isArray(value)) return String(value[0] || "").trim();
    return String(value || "").trim();
  };

  const cfConnectingIp = getHeader("cf-connecting-ip");
  const forwardedFor = getHeader("x-forwarded-for");
  const realIp = getHeader("x-real-ip");

  let ipAddress = null;
  let ipSource = "unknown";
  if (cfConnectingIp) {
    ipAddress = cfConnectingIp;
    ipSource = "cf-connecting-ip";
  } else if (forwardedFor) {
    ipAddress = forwardedFor.split(",")[0].trim() || null;
    ipSource = "x-forwarded-for";
  } else if (realIp) {
    ipAddress = realIp;
    ipSource = "x-real-ip";
  } else {
    ipAddress = String(req.ip || req.socket?.remoteAddress || "").trim() || null;
    ipSource = ipAddress ? "req.ip" : "unknown";
  }

  const userAgent = String(req.headers["user-agent"] || "").trim() || null;
  const lowerUA = String(userAgent || "").toLowerCase();

  const deviceType = lowerUA.includes("bot") || lowerUA.includes("spider") || lowerUA.includes("crawler")
    ? "bot"
    : (lowerUA.includes("ipad") || lowerUA.includes("tablet"))
      ? "tablet"
      : (lowerUA.includes("mobi") || lowerUA.includes("android") || lowerUA.includes("iphone"))
        ? "mobile"
        : userAgent
          ? "desktop"
          : "unknown";

  const os = lowerUA.includes("windows")
    ? "Windows"
    : lowerUA.includes("mac os") || lowerUA.includes("macintosh")
      ? "macOS"
      : lowerUA.includes("android")
        ? "Android"
        : lowerUA.includes("iphone") || lowerUA.includes("ipad") || lowerUA.includes("ios")
          ? "iOS"
          : lowerUA.includes("linux")
            ? "Linux"
            : "unknown";

  const browser = lowerUA.includes("edg/")
    ? "Edge"
    : lowerUA.includes("chrome/")
      ? "Chrome"
      : lowerUA.includes("safari/") && !lowerUA.includes("chrome/")
        ? "Safari"
        : lowerUA.includes("firefox/")
          ? "Firefox"
          : lowerUA.includes("opr/") || lowerUA.includes("opera")
            ? "Opera"
            : "unknown";

  const cloudflareCountry = getHeader("cf-ipcountry");
  const vercelCountry = getHeader("x-vercel-ip-country");
  const vercelRegion = getHeader("x-vercel-ip-country-region");
  const vercelCity = getHeader("x-vercel-ip-city");
  const vercelTimezone = getHeader("x-vercel-ip-timezone");
  const cfLatitude = getHeader("cf-iplatitude");
  const cfLongitude = getHeader("cf-iplongitude");

  const hasCloudflareLocation = Boolean(cloudflareCountry || cfLatitude || cfLongitude);
  const hasVercelLocation = Boolean(vercelCountry || vercelRegion || vercelCity || vercelTimezone);
  const locationSource = hasCloudflareLocation ? "cloudflare" : hasVercelLocation ? "vercel" : "none";

  const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const location = {
    country: cloudflareCountry || vercelCountry || null,
    region: vercelRegion || null,
    city: vercelCity || null,
    timezone: vercelTimezone || null,
    latitude: toNumberOrNull(cfLatitude),
    longitude: toNumberOrNull(cfLongitude),
    source: locationSource,
  };

  req._requestMeta = {
    ipAddress,
    ipSource,
    userAgent,
    device: {
      type: deviceType,
      os,
      browser,
    },
    location,
  };

  return req._requestMeta;
};

const runInBackground = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .catch((error) => {
      console.error(`${label} failed:`, error.message);
    });
};

const safeCreateAuthAudit = ({
  req,
  user = null,
  email = null,
  role = null,
  provider = "unknown",
  portal = "unknown",
  eventType,
  outcome = "INFO",
  reasonCode = null,
  message = "",
  sessionId = null,
  metadata = {},
} = {}) => {
  const { ipAddress, ipSource, userAgent, device, location } = getRequestMeta(req);
  runInBackground("Auth audit log write", async () => {
    await AuthAuditLog.create({
      user: user?._id || null,
      email: normalizeEmail(email || user?.email || ""),
      role: role || user?.role || null,
      provider,
      portal,
      eventType,
      outcome,
      reasonCode,
      message,
      sessionId,
      ipAddress,
      ipSource,
      userAgent,
      device,
      location,
      metadata,
    });
  });
};

const safeStartSessionHistory = ({
  req,
  user,
  sessionId,
  provider = "unknown",
  portal = "unknown",
  metadata = {},
} = {}) => {
  if (!user?._id || !sessionId) return;
  const { ipAddress, ipSource, userAgent, device, location } = getRequestMeta(req);
  runInBackground("Auth session start log write", async () => {
    await AuthSessionHistory.updateOne(
      { sessionId },
      {
        $setOnInsert: {
          user: user._id,
          email: normalizeEmail(user.email || ""),
          role: user.role || null,
          provider,
          portal,
          sessionId,
          startedAt: new Date(),
          isActive: true,
          endedAt: null,
          endedReason: null,
          ipAddress,
          ipSource,
          userAgent,
          device,
          location,
          metadata,
        },
      },
      { upsert: true },
    );
  });
};

const safeEndSessionHistory = ({
  userId = null,
  sessionId = null,
  reason = "UNKNOWN",
} = {}) => {
  if (!sessionId) return;
  runInBackground("Auth session end log write", async () => {
    const filter = userId ? { user: userId, sessionId } : { sessionId };
    await AuthSessionHistory.updateOne(
      filter,
      {
        $set: {
          isActive: false,
          endedAt: new Date(),
          endedReason: reason,
        },
      },
    );
  });
};

const getRoleBindingByName = async (roleName) => {
  const normalizedRoleName = String(roleName || "").trim().toLowerCase();
  if (!normalizedRoleName) return null;
  const roleDoc = await Role.findOne({ name: normalizedRoleName }).select("_id permissions").lean();
  if (!roleDoc) return null;
  return {
    roleRef: roleDoc._id,
    permissionRefs: Array.isArray(roleDoc.permissions) ? roleDoc.permissions : [],
  };
};

const buildTrialSubscription = () => {
  const trialStartDate = new Date();
  const subscriptionExpiry = new Date(trialStartDate);
  subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 7);
  return {
    subscriptionPlan: "trial",
    trialStartDate,
    subscriptionExpiry,
    paymentStatus: "none",
  };
};

/** Mobile onboarding: need real name + at least one sport on the user profile. */
const computeMobileNeedsOnboarding = (user) => {
  const fn = String(user?.firstName || "").trim();
  const ln = String(user?.lastName || "").trim();
  const sports = Array.isArray(user?.sportsInterests) ? user.sportsInterests.filter(Boolean) : [];
  if (fn.length < 1 || ln.length < 1) return true;
  if (sports.length < 1) return true;
  return false;
};

const buildMobileAuthResponseData = (user, token, needsOnboarding) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  profilePhoto: user.profilePhoto,
  academyId: user.academyId || null,
  subscriptionPlan: user.subscriptionPlan,
  subscriptionExpiry: user.subscriptionExpiry,
  trialStartDate: user.trialStartDate,
  paymentStatus: user.paymentStatus,
  subscriptionPromptOpenCount: user.subscriptionPromptOpenCount || 0,
  subscriptionPromptLastShownAt: user.subscriptionPromptLastShownAt || null,
  isEmailVerified: getEmailVerificationStatus(user),
  isPhoneVerified: getPhoneVerificationStatus(user),
  needsOnboarding: Boolean(needsOnboarding),
  token,
});

const isEmailInUse = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  const [userMatch, coachMatch, academyMatch] = await Promise.all([
    User.findOne({ email: normalizedEmail }).select("_id").lean(),
    Coach.findOne({ email: normalizedEmail }).select("_id").lean(),
    SportsAcademy.findOne({
      $or: [{ email: normalizedEmail }, { "metadata.pendingAdminEmail": normalizedEmail }],
    })
      .select("_id")
      .lean(),
  ]);

  return Boolean(userMatch || coachMatch || academyMatch);
};

const isPhoneInUse = async (phone) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;

  const [userMatch, coachMatch, academyMatch] = await Promise.all([
    User.findOne({ phone: normalizedPhone }).select("_id").lean(),
    Coach.findOne({ phone: normalizedPhone }).select("_id").lean(),
    SportsAcademy.findOne({
      $or: [{ phone: normalizedPhone }, { "metadata.pendingAdminPhone": normalizedPhone }],
    })
      .select("_id")
      .lean(),
  ]);

  return Boolean(userMatch || coachMatch || academyMatch);
};
const findExistingContactUsage = async ({ email, phone }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const checks = [];

  if (normalizedEmail) {
    checks.push({ email: normalizedEmail });
    checks.push({ "metadata.pendingAdminEmail": normalizedEmail });
  }
  if (normalizedPhone) {
    checks.push({ phone: normalizedPhone });
    checks.push({ "metadata.pendingAdminPhone": normalizedPhone });
  }
  if (checks.length === 0) return null;

  const [userMatch, coachMatch, academyMatch] = await Promise.all([
    User.findOne({ $or: checks }).select("_id email phone metadata").lean(),
    Coach.findOne({ $or: checks }).select("_id email phone metadata").lean(),
    SportsAcademy.findOne({ $or: checks }).select("_id email phone metadata").lean(),
  ]);

  return userMatch || coachMatch || academyMatch || null;
};

const ensureTrialForEligibleUser = async (user) => {
  if (!user) return user;
  if (!TRIAL_ELIGIBLE_ROLES.includes(String(user.role || "").toLowerCase())) return user;

  const currentPlan = String(user.subscriptionPlan || "").toLowerCase();
  const paymentStatus = String(user.paymentStatus || "").toLowerCase();
  const hasPaidPlan = ["basic", "premium", "enterprise"].includes(currentPlan) && paymentStatus === "active";
  if (hasPaidPlan) return user;

  // Backfill trial for legacy accounts that were created before trial defaults were introduced.
  const hasTrialData = currentPlan === "trial" && user.subscriptionExpiry;
  if (hasTrialData) return user;

  if (!currentPlan || currentPlan === "free" || currentPlan === "trial") {
    Object.assign(user, buildTrialSubscription());
    await user.save();
  }

  return user;
};

const shouldTrackSubscriptionPromptOnLogin = (user) => {
  if (!user) return false;
  if (!TRIAL_ELIGIBLE_ROLES.includes(user.role)) return false;

  const now = new Date();
  const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  const isExpired = expiry ? now > expiry : false;
  const currentPlan = String(user.subscriptionPlan || "").toLowerCase();
  const hasPaidPlan = ["basic", "premium", "enterprise"].includes(currentPlan);
  const isPaymentActive = String(user.paymentStatus || "").toLowerCase() === "active";

  return isExpired && (!hasPaidPlan || !isPaymentActive);
};

const trackSubscriptionPromptOpenOnLogin = async (user) => {
  if (!shouldTrackSubscriptionPromptOnLogin(user)) {
    return user;
  }

  user.subscriptionPromptOpenCount = Number(user.subscriptionPromptOpenCount || 0) + 1;
  user.subscriptionPromptLastShownAt = new Date();
  await user.save();
  return user;
};

const upsertPlayerProfileForUser = async ({
  user,
  firstName = "",
  lastName = "",
  photo = "",
}) => {
  if (!user || user.role !== "player") return;
  const fullName = `${firstName || user.firstName || ""} ${lastName || user.lastName || ""}`.trim();

  try {
    let existingProfile = await Player.findOne({ user: user._id });

    if (!existingProfile && user.email) {
      existingProfile = await Player.findOne({ email: normalizeEmail(user.email) });
    }

    if (existingProfile) {
      existingProfile.user = user._id;
      existingProfile.name = fullName || existingProfile.name;
      existingProfile.email = normalizeEmail(user.email || existingProfile.email);
      existingProfile.phone = normalizePhone(user.phone || existingProfile.phone);
      if (photo) existingProfile.photo = photo;
      await existingProfile.save();
      return;
    }

    await Player.create({
      user: user._id,
      name: fullName || "Player",
      email: normalizeEmail(user.email || ""),
      phone: normalizePhone(user.phone || ""),
      photo: photo || "",
    });
  } catch (playerErr) {
    console.error("Auto-create player profile warning:", playerErr.message);
  }
};

// @desc    Check email/phone availability before registration submit
// @route   POST /api/auth/check-contact
// @access  Public
export const checkContactAvailability = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required",
      });
    }

    const [emailInUse, phoneInUse] = await Promise.all([
      isEmailInUse(email),
      isPhoneInUse(phone),
    ]);

    return res.json({
      success: true,
      data: {
        emailInUse,
        phoneInUse,
      },
    });
  } catch (error) {
    console.error("Check contact availability error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { firstName, lastName, password } = req.body;
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const normalizedRole = "player";
    const playerRoleBinding = await getRoleBindingByName(normalizedRole);
    if (!playerRoleBinding) {
      return res.status(500).json({
        success: false,
        message: "Player role not found. Ensure RBAC roles are seeded.",
      });
    }
    const trialData = TRIAL_ELIGIBLE_ROLES.includes(normalizedRole) ? buildTrialSubscription() : {};

    // // Check if user exists
    // const userExists = await User.findOne({ email, phone });
    // if (userExists) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "User already exists with this credentials",
    //   });
    // }

    // Check if email or phone already exists across all role stores
    const existingContact = await findExistingContactUsage({ email, phone });
    if (existingContact) {
      const existingEmail = normalizeEmail(existingContact.email || existingContact?.metadata?.pendingAdminEmail || "");
      const message = existingEmail && existingEmail === email
        ? DUPLICATE_EMAIL_MESSAGE
        : DUPLICATE_PHONE_MESSAGE;
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Create user (verification is completed via OTP)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role: normalizedRole,
      roleRef: playerRoleBinding.roleRef,
      permissionRefs: playerRoleBinding.permissionRefs,
      isActive: true,
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false,
      ...trialData,
    });

    await upsertPlayerProfileForUser({
      user,
      firstName,
      lastName,
    });

    // Generate OTP for email verification first. Phone OTP is created only after email verification.
    const emailOtp = setEmailOtp(user);
    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;
    await user.save();

    // Send email OTP to verify email ownership
    const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    res.status(201).json({
      success: true,
      message: "Verify your email to complete registration. You can verify phone later.",
      data: {
        _id: user._id,
        email: user.email,
        phone: user.phone,
        emailVerified: false,
        phoneVerified: getPhoneVerificationStatus(user),
        needsVerification: true,
      },
    });
  } catch (error) {
    await safeCreateAuthAudit({
      req,
      email: normalizeEmail(req.body?.email),
      provider: "password",
      portal: "user",
      eventType: "LOGIN_FAILED",
      outcome: "FAILED",
      reasonCode: "SERVER_ERROR",
      message: "Server error during registration",
    });
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0];
      if (duplicateField === "email") {
        return res.status(409).json({
          success: false,
          code: DUPLICATE_EMAIL_CODE,
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
      if (duplicateField === "phone") {
        return res.status(409).json({
          success: false,
          code: DUPLICATE_PHONE_CODE,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
    }
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    });
  }
};

// @desc    Bootstrap superadmin account (one-time setup)
// @route   POST /api/auth/bootstrap-superadmin
// @access  Public (protected by setup key)
export const bootstrapSuperAdmin = async (req, res) => {
  try {
    const setupKey = String(
      req.headers["x-setup-key"] ||
      req.body?.setupKey ||
      ""
    ).trim();
    const expectedSetupKey = String(process.env.SUPERADMIN_SETUP_KEY || "").trim();

    if (!expectedSetupKey) {
      return res.status(500).json({
        success: false,
        message: "SUPERADMIN_SETUP_KEY is not configured on server",
      });
    }

    if (!setupKey || setupKey !== expectedSetupKey) {
      return res.status(403).json({
        success: false,
        message: "Invalid setup key",
      });
    }

    const existingSuperAdmin = await User.findOne({ role: "superadmin" }).select("_id email").lean();
    if (existingSuperAdmin) {
      return res.status(409).json({
        success: false,
        code: "SUPERADMIN_ALREADY_EXISTS",
        message: "Superadmin already exists. Please use /api/auth/admin-login.",
        data: {
          superAdminId: existingSuperAdmin._id,
          email: existingSuperAdmin.email,
        },
      });
    }

    const { firstName, lastName = "", password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);

    if (!firstName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "firstName, email, phone and password are required",
      });
    }

    const [emailInUse, phoneInUse] = await Promise.all([
      isEmailInUse(email),
      isPhoneInUse(phone),
    ]);

    if (emailInUse) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    if (phoneInUse) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_PHONE_MESSAGE,
      });
    }

    const superAdminRole = await Role.findOne({ name: "superadmin" }).select("_id permissions");
    if (!superAdminRole) {
      return res.status(500).json({
        success: false,
        message: "Superadmin role not found. Ensure RBAC seeding has run.",
      });
    }

    const superAdmin = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role: "superadmin",
      baseRole: "superadmin",
      activeRole: "superadmin",
      roleRef: superAdminRole._id,
      permissionRefs: Array.isArray(superAdminRole.permissions) ? superAdminRole.permissions : [],
      isActive: true,
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false,
    });

    // Send email OTP first; phone OTP will be generated only after email verification.
    const emailOtp = setEmailOtp(superAdmin);
    superAdmin.phoneOtp = undefined;
    superAdmin.phoneOtpExpire = undefined;
    await superAdmin.save();

    const emailTemplate = emailTemplates.otpVerification(emailOtp, superAdmin.firstName);
    await sendEmail({
      to: superAdmin.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return res.status(201).json({
      success: true,
      message: "Superadmin created. Email OTP sent for verification. Phone OTP will be sent after email verification.",
      data: {
        _id: superAdmin._id,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        email: superAdmin.email,
        phone: superAdmin.phone,
        role: superAdmin.role,
        roleRef: superAdmin.roleRef,
        permissionRefs: superAdmin.permissionRefs || [],
        needsVerification: true,
        emailVerified: false,
        phoneVerified: false,
        phoneOtpSent: false,
      },
    });
  } catch (error) {
    console.error("Bootstrap superadmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during superadmin bootstrap",
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;
    const forceLogin = parseBooleanFlag(req.body?.forceLogin);

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      // Check if this email has a pending Coach registration
      const pendingCoach = await Coach.findOne({ email });
      if (pendingCoach) {
        if (pendingCoach.status === "REJECTED") {
          await safeCreateAuthAudit({
            req,
            email,
            provider: "password",
            portal: "pending",
            eventType: "LOGIN_FAILED",
            outcome: "FAILED",
            reasonCode: "REGISTRATION_REJECTED",
            message: "Pending coach registration rejected",
          });
          return res.status(403).json({
            success: false,
            code: "REGISTRATION_REJECTED",
            message: "Your coach registration has been rejected. Please contact support.",
          });
        }

        // Verify password from metadata
        const storedPassword = pendingCoach.metadata?.get("pendingUserPassword");
        const storedGoogleId = pendingCoach.metadata?.get("googleId");

        if (!storedGoogleId) {
          const bcrypt = await import("bcryptjs");
          const isMatch = storedPassword && await bcrypt.default.compare(password, storedPassword);
          if (!isMatch) {
            await safeCreateAuthAudit({
              req,
              email,
              provider: "password",
              portal: "pending",
              eventType: "LOGIN_FAILED",
              outcome: "FAILED",
              reasonCode: "INVALID_CREDENTIALS",
              message: "Invalid credentials for pending coach login",
            });
            return res.status(401).json({ success: false, message: "Invalid email or password" });
          }
        }

        const token = generateToken(pendingCoach._id);
        await safeCreateAuthAudit({
          req,
          email: pendingCoach.email,
          role: "coach",
          provider: "password",
          portal: "pending",
          eventType: "LOGIN_SUCCESS",
          outcome: "SUCCESS",
          message: "Pending coach login successful",
        });
        return res.json({
          success: true,
          message: "Login successful",
          data: {
            _id: pendingCoach._id,
            firstName: pendingCoach.firstName,
            lastName: pendingCoach.lastName,
            email: pendingCoach.email,
            isPending: true,
            pendingRole: "coach",
            status: pendingCoach.status,
            kycStatus: pendingCoach.kycStatus,
            token,
          },
        });
      }

      // Check if this email has a pending Academy registration
      const pendingAcademy = await SportsAcademy.findOne({
        "metadata.pendingAdminEmail": email,
      });
      if (pendingAcademy) {
        if (pendingAcademy.status === "REJECTED") {
          await safeCreateAuthAudit({
            req,
            email,
            provider: "password",
            portal: "pending",
            eventType: "LOGIN_FAILED",
            outcome: "FAILED",
            reasonCode: "REGISTRATION_REJECTED",
            message: "Pending academy registration rejected",
          });
          return res.status(403).json({
            success: false,
            code: "REGISTRATION_REJECTED",
            message: "Your academy registration has been rejected. Please contact support.",
          });
        }

        const storedPassword = pendingAcademy.metadata?.get("pendingAdminPassword");
        const storedGoogleId = pendingAcademy.metadata?.get("adminGoogleId");

        if (!storedGoogleId) {
          const bcrypt = await import("bcryptjs");
          const isMatch = storedPassword && await bcrypt.default.compare(password, storedPassword);
          if (!isMatch) {
            await safeCreateAuthAudit({
              req,
              email,
              provider: "password",
              portal: "pending",
              eventType: "LOGIN_FAILED",
              outcome: "FAILED",
              reasonCode: "INVALID_CREDENTIALS",
              message: "Invalid credentials for pending academy login",
            });
            return res.status(401).json({ success: false, message: "Invalid email or password" });
          }
        }

        const adminFirstName = pendingAcademy.metadata?.get("pendingAdminFirstName");
        const adminLastName = pendingAcademy.metadata?.get("pendingAdminLastName");
        const token = generateToken(pendingAcademy._id);
        await safeCreateAuthAudit({
          req,
          email,
          role: "academyadmin",
          provider: "password",
          portal: "pending",
          eventType: "LOGIN_SUCCESS",
          outcome: "SUCCESS",
          message: "Pending academy login successful",
        });
        return res.json({
          success: true,
          message: "Login successful",
          data: {
            _id: pendingAcademy._id,
            firstName: adminFirstName || pendingAcademy.name,
            lastName: adminLastName || "",
            email,
            isPending: true,
            pendingRole: "academy",
            status: pendingAcademy.status,
            kycStatus: pendingAcademy.kycStatus,
            token,
          },
        });
      }

      await safeCreateAuthAudit({
        req,
        email,
        provider: "password",
        portal: "user",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "INVALID_CREDENTIALS",
        message: "Login failed: user not found",
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "user",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "ACCOUNT_DEACTIVATED",
        message: "Attempted login to deactivated account",
      });
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    if (user.role === "superadmin") {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "user",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "WRONG_PORTAL",
        message: "Superadmin attempted login via user portal",
      });
      return res.status(403).json({
        success: false,
        message: "Super admin must login from /adminlogin",
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "user",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "INVALID_CREDENTIALS",
        message: "Invalid password for login",
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const previousSessionId = user.activeSessionId || null;
    if (hasActiveSession(user) && !forceLogin) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "user",
        eventType: "LOGIN_BLOCKED_ACTIVE_SESSION",
        outcome: "BLOCKED",
        reasonCode: ACTIVE_SESSION_EXISTS_CODE,
        message: "Login blocked due to active session",
        sessionId: previousSessionId,
      });
      return res.status(409).json(buildActiveSessionPayload(user));
    }

    if (!hasActiveSession(user) || forceLogin) {
      user.activeSessionId = createSessionId();
    }

    if (forceLogin && previousSessionId) {
      await safeEndSessionHistory({
        userId: user._id,
        sessionId: previousSessionId,
        reason: "FORCE_TAKEOVER",
      });
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "user",
        eventType: "SESSION_INVALIDATED",
        outcome: "SUCCESS",
        reasonCode: "FORCE_TAKEOVER",
        message: "Previous session invalidated by force login",
        sessionId: previousSessionId,
      });
    }

    // Keep login allowed even when verification is pending (skip for now flow).
    if (!isAuthVerificationComplete(user)) {
      const emailVerified = getEmailVerificationStatus(user);

      if (!emailVerified) {
        const emailOtp = ensureEmailOtp(user);
        const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });
      }

      if (
        emailVerified &&
        REQUIRE_PHONE_OTP_VERIFICATION &&
        !getPhoneVerificationStatus(user) &&
        user.phone
      ) {
        const phoneOtp = ensurePhoneOtp(user);
        const smsResult = await sendPhoneOtp({ phone: user.phone, otp: phoneOtp });
        if (!smsResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to send phone verification OTP",
          });
        }
      }

      await user.save();
    }

    if (user.isModified("activeSessionId")) {
      await user.save();
    }

    await ensureTrialForEligibleUser(user);

    // Generate token
    const token = generateToken({ id: user._id, sid: user.activeSessionId });
    await safeStartSessionHistory({
      req,
      user,
      sessionId: user.activeSessionId,
      provider: "password",
      portal: "user",
      metadata: {
        forceLogin,
      },
    });
    await safeCreateAuthAudit({
      req,
      user,
      provider: "password",
      portal: "user",
      eventType: forceLogin ? "LOGIN_FORCE_TAKEOVER" : "LOGIN_SUCCESS",
      outcome: "SUCCESS",
      sessionId: user.activeSessionId,
      message: forceLogin ? "Force login successful; active session replaced" : "Login successful",
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhoto: user.profilePhoto,
        academyId: user.academyId || null,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        trialStartDate: user.trialStartDate,
        paymentStatus: user.paymentStatus,
        subscriptionPromptOpenCount: user.subscriptionPromptOpenCount || 0,
        subscriptionPromptLastShownAt: user.subscriptionPromptLastShownAt || null,
        isEmailVerified: getEmailVerificationStatus(user),
        isPhoneVerified: getPhoneVerificationStatus(user),
        verificationPending: !isAuthVerificationComplete(user),
        token,
      },
    });
  } catch (error) {
    await safeCreateAuthAudit({
      req,
      email: normalizeEmail(req.body?.email),
      provider: "password",
      portal: "user",
      eventType: "LOGIN_FAILED",
      outcome: "FAILED",
      reasonCode: "SERVER_ERROR",
      message: "Server error during login",
    });
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

// @desc    Login superadmin user
// @route   POST /api/auth/admin-login
// @access  Public
export const adminLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;
    const forceLogin = parseBooleanFlag(req.body?.forceLogin);

    const user = await User.findOne({ email });
    if (!user) {
      await safeCreateAuthAudit({
        req,
        email,
        provider: "password",
        portal: "admin",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "INVALID_CREDENTIALS",
        message: "Invalid email for admin login",
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.role !== "superadmin") {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "admin",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "ROLE_NOT_ALLOWED",
        message: "Non-superadmin attempted admin portal login",
      });
      return res.status(403).json({
        success: false,
        message: "Only superadmin can login from /adminlogin",
      });
    }

    if (!user.isActive) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "admin",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "ACCOUNT_DEACTIVATED",
        message: "Deactivated superadmin attempted login",
      });
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "admin",
        eventType: "LOGIN_FAILED",
        outcome: "FAILED",
        reasonCode: "INVALID_CREDENTIALS",
        message: "Invalid password for admin login",
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const previousSessionId = user.activeSessionId || null;
    if (hasActiveSession(user) && !forceLogin) {
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "admin",
        eventType: "LOGIN_BLOCKED_ACTIVE_SESSION",
        outcome: "BLOCKED",
        reasonCode: ACTIVE_SESSION_EXISTS_CODE,
        message: "Admin login blocked due to active session",
        sessionId: previousSessionId,
      });
      return res.status(409).json(buildActiveSessionPayload(user));
    }

    if (!hasActiveSession(user) || forceLogin) {
      user.activeSessionId = createSessionId();
    }

    if (forceLogin && previousSessionId) {
      await safeEndSessionHistory({
        userId: user._id,
        sessionId: previousSessionId,
        reason: "FORCE_TAKEOVER",
      });
      await safeCreateAuthAudit({
        req,
        user,
        provider: "password",
        portal: "admin",
        eventType: "SESSION_INVALIDATED",
        outcome: "SUCCESS",
        reasonCode: "FORCE_TAKEOVER",
        message: "Previous admin session invalidated by force login",
        sessionId: previousSessionId,
      });
    }

    // Allow login even when verification is pending.
    // If email is not verified, resend email OTP.
    // Phone OTP is sent only after email is verified.
    if (!isAuthVerificationComplete(user)) {
      const emailVerified = getEmailVerificationStatus(user);

      if (!emailVerified) {
        const emailOtp = ensureEmailOtp(user);
        const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
        await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });
      }

      if (
        emailVerified &&
        REQUIRE_PHONE_OTP_VERIFICATION &&
        !getPhoneVerificationStatus(user) &&
        user.phone
      ) {
        const phoneOtp = ensurePhoneOtp(user);
        const smsResult = await sendPhoneOtp({ phone: user.phone, otp: phoneOtp });
        if (!smsResult.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to send phone verification OTP",
          });
        }
      }

      await user.save();
    }

    if (user.isModified("activeSessionId")) {
      await user.save();
    }

    const token = generateToken({ id: user._id, sid: user.activeSessionId });
    await safeStartSessionHistory({
      req,
      user,
      sessionId: user.activeSessionId,
      provider: "password",
      portal: "admin",
      metadata: {
        forceLogin,
      },
    });
    await safeCreateAuthAudit({
      req,
      user,
      provider: "password",
      portal: "admin",
      eventType: forceLogin ? "LOGIN_FORCE_TAKEOVER" : "LOGIN_SUCCESS",
      outcome: "SUCCESS",
      sessionId: user.activeSessionId,
      message: forceLogin
        ? "Admin force login successful; previous session replaced"
        : "Admin login successful",
    });
    return res.json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhoto: user.profilePhoto,
        isEmailVerified: getEmailVerificationStatus(user),
        isPhoneVerified: getPhoneVerificationStatus(user),
        verificationPending: !isAuthVerificationComplete(user),
        token,
      },
    });
  } catch (error) {
    await safeCreateAuthAudit({
      req,
      email: normalizeEmail(req.body?.email),
      provider: "password",
      portal: "admin",
      eventType: "LOGIN_FAILED",
      outcome: "FAILED",
      reasonCode: "SERVER_ERROR",
      message: "Server error during admin login",
    });
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

// @desc    Google OAuth login/register
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { googleId, firstName, lastName, profilePhoto } =
      req.body;
    const forceLogin = parseBooleanFlag(req.body?.forceLogin);
    const email = normalizeEmail(req.body?.email);
    const normalizedNames = normalizeGoogleNames({ firstName, lastName, email });
    const normalizedPhone = normalizePhone(req.body?.phone);

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      await ensureTrialForEligibleUser(user);

      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (normalizedPhone && !user.phone) {
        user.phone = normalizedPhone;
      }
      // Keep Google profile photo in sync (used as avatar fallback across the app).
      if (profilePhoto) {
        const incomingPhoto = String(profilePhoto || "").trim();
        if (incomingPhoto && incomingPhoto !== String(user.profilePhoto || "").trim()) {
          user.profilePhoto = incomingPhoto;
        }
      }
      if (
        user.isModified("googleId") ||
        user.isModified("phone") ||
        user.isModified("profilePhoto")
      ) {
        await user.save();
      }

      if (!user.isActive) {
        await safeCreateAuthAudit({
          req,
          user,
          provider: "google",
          portal: "user",
          eventType: "LOGIN_FAILED",
          outcome: "FAILED",
          reasonCode: "ACCOUNT_DEACTIVATED",
          message: "Deactivated account attempted Google login",
        });
        return res.status(401).json({
          success: false,
          message:
            "Your account has been deactivated. Please contact support.",
        });
      }

      const previousSessionId = user.activeSessionId || null;
      if (hasActiveSession(user) && !forceLogin) {
        await safeCreateAuthAudit({
          req,
          user,
          provider: "google",
          portal: user.role === "superadmin" ? "admin" : "user",
          eventType: "LOGIN_BLOCKED_ACTIVE_SESSION",
          outcome: "BLOCKED",
          reasonCode: ACTIVE_SESSION_EXISTS_CODE,
          message: "Google login blocked due to active session",
          sessionId: previousSessionId,
        });
        return res.status(409).json(buildActiveSessionPayload(user));
      }

      if (!hasActiveSession(user) || forceLogin) {
        user.activeSessionId = createSessionId();
      }

      if (forceLogin && previousSessionId) {
        await safeEndSessionHistory({
          userId: user._id,
          sessionId: previousSessionId,
          reason: "FORCE_TAKEOVER",
        });
        await safeCreateAuthAudit({
          req,
          user,
          provider: "google",
          portal: user.role === "superadmin" ? "admin" : "user",
          eventType: "SESSION_INVALIDATED",
          outcome: "SUCCESS",
          reasonCode: "FORCE_TAKEOVER",
          message: "Previous session invalidated by Google force login",
          sessionId: previousSessionId,
        });
      }

      if (!isAuthVerificationComplete(user)) {
        const emailVerified = getEmailVerificationStatus(user);

        if (!emailVerified) {
          const emailOtp = ensureEmailOtp(user);
          const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
          await sendEmail({
            to: user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });
        }

        if (
          emailVerified &&
          REQUIRE_PHONE_OTP_VERIFICATION &&
          !getPhoneVerificationStatus(user) &&
          user.phone
        ) {
          const phoneOtp = ensurePhoneOtp(user);
          const smsResult = await sendPhoneOtp({ phone: user.phone, otp: phoneOtp });
          if (!smsResult.success) {
            return res.status(500).json({
              success: false,
              message: "Failed to send phone verification OTP",
            });
          }
        }

        await user.save();
      }

      await trackSubscriptionPromptOpenOnLogin(user);
      if (user.isModified("activeSessionId")) {
        await user.save();
      }
      const token = generateToken({ id: user._id, sid: user.activeSessionId });
      await safeStartSessionHistory({
        req,
        user,
        sessionId: user.activeSessionId,
        provider: "google",
        portal: user.role === "superadmin" ? "admin" : "user",
        metadata: {
          forceLogin,
        },
      });
      await safeCreateAuthAudit({
        req,
        user,
        provider: "google",
        portal: user.role === "superadmin" ? "admin" : "user",
        eventType: forceLogin ? "LOGIN_FORCE_TAKEOVER" : "LOGIN_SUCCESS",
        outcome: "SUCCESS",
        sessionId: user.activeSessionId,
        message: forceLogin
          ? "Google force login successful; previous session replaced"
          : "Google authentication successful",
      });

      return res.json({
        success: true,
        message: "Google authentication successful",
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profilePhoto: user.profilePhoto,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionExpiry: user.subscriptionExpiry,
          trialStartDate: user.trialStartDate,
          paymentStatus: user.paymentStatus,
          subscriptionPromptOpenCount: user.subscriptionPromptOpenCount || 0,
          subscriptionPromptLastShownAt: user.subscriptionPromptLastShownAt || null,
          isEmailVerified: getEmailVerificationStatus(user),
          isPhoneVerified: getPhoneVerificationStatus(user),
          verificationPending: !isAuthVerificationComplete(user),
          isNewUser: false,
          token,
        },
      });
    }

    // Check if this Google email has a pending Coach/Academy registration
    const pendingCoach = await Coach.findOne({ email });
    if (pendingCoach) {
      if (pendingCoach.status === "REJECTED") {
        return res.status(403).json({
          success: false,
          code: "REGISTRATION_REJECTED",
          message: "Your coach registration has been rejected. Please contact support.",
        });
      }
      const token = generateToken(pendingCoach._id);
      return res.json({
        success: true,
        data: {
          _id: pendingCoach._id,
          firstName: pendingCoach.firstName,
          lastName: pendingCoach.lastName,
          email: pendingCoach.email,
          isPending: true,
          pendingRole: "coach",
          status: pendingCoach.status,
          kycStatus: pendingCoach.kycStatus,
          token,
        },
      });
    }

    const pendingAcademy = await SportsAcademy.findOne({
      "metadata.pendingAdminEmail": email,
    });
    if (pendingAcademy) {
      if (pendingAcademy.status === "REJECTED") {
        return res.status(403).json({
          success: false,
          code: "REGISTRATION_REJECTED",
          message: "Your academy registration has been rejected. Please contact support.",
        });
      }
      const adminFirstName = pendingAcademy.metadata?.get("pendingAdminFirstName");
      const adminLastName = pendingAcademy.metadata?.get("pendingAdminLastName");
      const token = generateToken(pendingAcademy._id);
      return res.json({
        success: true,
        data: {
          _id: pendingAcademy._id,
          firstName: adminFirstName || pendingAcademy.name,
          lastName: adminLastName || "",
          email,
          isPending: true,
          pendingRole: "academy",
          status: pendingAcademy.status,
          kycStatus: pendingAcademy.kycStatus,
          token,
        },
      });
    }

    // New Google user should complete signup first (phone required).
    if (!normalizedPhone) {
      console.info(
        `[GOOGLE_AUTH] New user requires signup completion: ${email || "unknown-email"}`,
      );
      return res.status(200).json({
        success: true,
        message: "New Google user. Complete signup with phone number.",
        data: {
          isNewUser: true,
          googleId,
          email,
          firstName: normalizedNames.firstName,
          lastName: normalizedNames.lastName,
          profilePhoto,
        },
      });
    }

    // New Google user defaults to player role.
    const normalizedRole = "player";
    const playerRoleBinding = await getRoleBindingByName(normalizedRole);
    if (!playerRoleBinding) {
      return res.status(500).json({
        success: false,
        message: "Player role not found. Ensure RBAC roles are seeded.",
      });
    }
    const trialData = TRIAL_ELIGIBLE_ROLES.includes(normalizedRole) ? buildTrialSubscription() : {};
    user = await User.create({
      googleId,
      email,
      firstName: normalizedNames.firstName,
      lastName: normalizedNames.lastName,
      phone: normalizedPhone,
      profilePhoto,
      role: normalizedRole,
      roleRef: playerRoleBinding.roleRef,
      permissionRefs: playerRoleBinding.permissionRefs,
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
      ...trialData,
    });

    await upsertPlayerProfileForUser({
      user,
      firstName: normalizedNames.firstName,
      lastName: normalizedNames.lastName,
      photo: profilePhoto || "",
    });

    const emailOtp = setEmailOtp(user);
    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;
    await user.save();

    // Send OTPs for first-time Google users as well
    const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    res.status(201).json({
      success: true,
      message: "Verify your email to complete registration. You can verify phone later.",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        profilePhoto: user.profilePhoto,
        emailVerified: false,
        phoneVerified: getPhoneVerificationStatus(user),
        needsVerification: true,
        isNewUser: false,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0];
      if (duplicateField === "email") {
        return res.status(409).json({
          success: false,
          code: DUPLICATE_EMAIL_CODE,
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
      if (duplicateField === "phone") {
        return res.status(409).json({
          success: false,
          code: DUPLICATE_PHONE_CODE,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
    }
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during Google authentication",
      error: error.message,
    });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
    const emailTemplate = emailTemplates.resetPassword(
      resetUrl,
      user.firstName,
    );

    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    res.json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Send OTP for email verification
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate OTP
    const otp = setEmailOtp(user);
    await user.save();

    // Send OTP email
    const emailTemplate = emailTemplates.otpVerification(otp, user.firstName);
    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeOtp(req.body?.otp);

    const user = await User.findOne({ email });

    if (!user) {
      const orphanPlayer = await Player.findOne({ email });
      return res.status(400).json({
        success: false,
        message: orphanPlayer
          ? "User account not found for this email. It may have been deleted; please register again."
          : "User not found",
      });
    }

    const isValidOtp =
      (normalizeOtp(user.emailOtp) === otp && isNotExpired(user.emailOtpExpire)) ||
      (normalizeOtp(user.otp) === otp && isNotExpired(user.otpExpire));
    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpire = undefined;
    user.otp = undefined;
    user.otpExpire = undefined;
    user.isVerified = true;
    await user.save();

    // Generate phone OTP only after email is verified.
    if (!getPhoneVerificationStatus(user) && user.phone) {
      const phoneOtp = ensurePhoneOtp(user);
      await user.save();
      const smsResult = await sendPhoneOtp({ phone: user.phone, otp: phoneOtp });
      if (!smsResult.success) {
        return res.status(500).json({
          success: false,
          message: "Email verified, but failed to send phone OTP",
        });
      }

      return res.json({
        success: true,
        message: "Email verified successfully. Phone OTP sent (optional). You can verify now or later.",
        data: {
          _id: user._id,
          email: user.email,
          phone: user.phone,
          emailVerified: true,
          phoneVerified: false,
          needsPhoneVerification: true,
          needsVerification: true,
        },
      });
    }

    await trackSubscriptionPromptOpenOnLogin(user);

    // Send welcome email once both verifications are completed.
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
    const name = `${user.firstName} ${user.lastName}`.trim();
    const welcomeTemplate = emailTemplates.welcomeEmail(name, user.role, loginUrl);
    await sendEmail({
      to: user.email,
      subject: welcomeTemplate.subject,
      html: welcomeTemplate.html,
    });

    user.activeSessionId = createSessionId();
    await user.save();

    const token = generateToken({ id: user._id, sid: user.activeSessionId });
    await safeStartSessionHistory({
      req,
      user,
      sessionId: user.activeSessionId,
      provider: "otp",
      portal: user.role === "superadmin" ? "admin" : "user",
      metadata: {
        source: "verifyOTP",
      },
    });
    await safeCreateAuthAudit({
      req,
      user,
      provider: "otp",
      portal: user.role === "superadmin" ? "admin" : "user",
      eventType: "TOKEN_ISSUED",
      outcome: "SUCCESS",
      sessionId: user.activeSessionId,
      message: "Token issued after email OTP verification",
    });

    return res.json({
      success: true,
      message: getPhoneVerificationStatus(user)
        ? "Email and phone verified successfully"
        : "Email verified successfully. Phone verification is optional and can be done later.",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhoto: user.profilePhoto,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        trialStartDate: user.trialStartDate,
        paymentStatus: user.paymentStatus,
        emailVerified: true,
        phoneVerified: getPhoneVerificationStatus(user),
        isEmailVerified: true,
        isPhoneVerified: getPhoneVerificationStatus(user),
        token,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Send OTP for phone verification
// @route   POST /api/auth/send-phone-otp
// @access  Public
export const sendPhoneOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is not available for this account",
      });
    }

    if (!getEmailVerificationStatus(user)) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first, then request phone OTP.",
      });
    }

    const otp = setPhoneOtp(user);
    await user.save();
    const smsResult = await sendPhoneOtp({ phone: user.phone, otp });
    if (!smsResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send phone OTP",
      });
    }

    return res.json({
      success: true,
      message: "Phone OTP sent successfully",
    });
  } catch (error) {
    console.error("Send phone OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Verify phone OTP
// @route   POST /api/auth/verify-phone-otp
// @access  Public
export const verifyPhoneOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const otp = normalizeOtp(req.body?.otp);
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (!(normalizeOtp(user.phoneOtp) === otp && isNotExpired(user.phoneOtpExpire))) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired phone OTP",
      });
    }

    user.isPhoneVerified = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;
    user.isVerified = getEmailVerificationStatus(user);
    await user.save();

    if (!getEmailVerificationStatus(user)) {
      const emailOtp = ensureEmailOtp(user);
      await user.save();
      const emailTemplate = emailTemplates.otpVerification(emailOtp, user.firstName);
      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
      return res.json({
        success: true,
        message: "Phone verified successfully. Please verify your email.",
        data: {
          _id: user._id,
          email: user.email,
          phone: user.phone,
          emailVerified: false,
          phoneVerified: true,
          needsEmailVerification: true,
          needsVerification: true,
        },
      });
    }

    user.isVerified = true;
    await user.save();
    await trackSubscriptionPromptOpenOnLogin(user);

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
    const name = `${user.firstName} ${user.lastName}`.trim();
    const welcomeTemplate = emailTemplates.welcomeEmail(name, user.role, loginUrl);
    await sendEmail({
      to: user.email,
      subject: welcomeTemplate.subject,
      html: welcomeTemplate.html,
    });

    user.activeSessionId = createSessionId();
    await user.save();

    const token = generateToken({ id: user._id, sid: user.activeSessionId });
    await safeStartSessionHistory({
      req,
      user,
      sessionId: user.activeSessionId,
      provider: "otp",
      portal: user.role === "superadmin" ? "admin" : "user",
      metadata: {
        source: "verifyPhoneOTP",
      },
    });
    await safeCreateAuthAudit({
      req,
      user,
      provider: "otp",
      portal: user.role === "superadmin" ? "admin" : "user",
      eventType: "TOKEN_ISSUED",
      outcome: "SUCCESS",
      sessionId: user.activeSessionId,
      message: "Token issued after phone OTP verification",
    });
    return res.json({
      success: true,
      message: "Email and phone verified successfully",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePhoto: user.profilePhoto,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        trialStartDate: user.trialStartDate,
        paymentStatus: user.paymentStatus,
        emailVerified: true,
        phoneVerified: true,
        token,
      },
    });
  } catch (error) {
    console.error("Verify phone OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Mobile: request email OTP (works before a User row exists)
// @route   POST /api/auth/mobile/request-email-otp
// @access  Public
export const requestMobileEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (
      !email ||
      !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    await MobilePendingEmailOtp.findOneAndUpdate(
      { email },
      { $set: { email, otp, expiresAt } },
      { upsert: true, new: true }
    );

    const emailTemplate = emailTemplates.otpVerification(otp, "there");
    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("requestMobileEmailOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Mobile: verify email OTP — create user or sign in, return JWT
// @route   POST /api/auth/mobile/verify-email-otp
// @access  Public
export const verifyMobileEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeOtp(req.body?.otp);
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const pending = await MobilePendingEmailOtp.findOne({ email });
    if (
      !pending ||
      normalizeOtp(pending.otp) !== otp ||
      !pending.expiresAt ||
      pending.expiresAt.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    await MobilePendingEmailOtp.deleteOne({ _id: pending._id });

    let user = await User.findOne({ email });

    if (user) {
      if (String(user.role || "").toLowerCase() === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Super admin accounts must use the admin sign-in flow.",
        });
      }

      user.isEmailVerified = true;
      user.isVerified = true;
      user.emailOtp = undefined;
      user.emailOtpExpire = undefined;
      user.otp = undefined;
      user.otpExpire = undefined;
      user.activeSessionId = createSessionId();
      await user.save();
      await ensureTrialForEligibleUser(user);
      await trackSubscriptionPromptOpenOnLogin(user);

      const token = generateToken({ id: user._id, sid: user.activeSessionId });
      await safeStartSessionHistory({
        req,
        user,
        sessionId: user.activeSessionId,
        provider: "mobile_email_otp",
        portal: "user",
        metadata: { source: "verifyMobileEmailOtp" },
      });
      await safeCreateAuthAudit({
        req,
        user,
        provider: "mobile_email_otp",
        portal: "user",
        eventType: "TOKEN_ISSUED",
        outcome: "SUCCESS",
        sessionId: user.activeSessionId,
        message: "Token issued after mobile email OTP (existing user)",
      });

      const needsOnboarding = computeMobileNeedsOnboarding(user);
      return res.json({
        success: true,
        message: "Signed in successfully",
        data: buildMobileAuthResponseData(user, token, needsOnboarding),
      });
    }

    const playerRoleBinding = await getRoleBindingByName("player");
    if (!playerRoleBinding) {
      return res.status(500).json({
        success: false,
        message: "Player role not found. Ensure RBAC roles are seeded.",
      });
    }

    const trialData = buildTrialSubscription();
    const randomPassword = crypto.randomBytes(32).toString("hex");

    user = await User.create({
      firstName: "Player",
      lastName: "",
      email,
      password: randomPassword,
      role: "player",
      roleRef: playerRoleBinding.roleRef,
      permissionRefs: playerRoleBinding.permissionRefs,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isPhoneVerified: false,
      ...trialData,
    });

    await upsertPlayerProfileForUser({
      user,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    user.activeSessionId = createSessionId();
    await user.save();

    const token = generateToken({ id: user._id, sid: user.activeSessionId });
    await safeStartSessionHistory({
      req,
      user,
      sessionId: user.activeSessionId,
      provider: "mobile_email_otp",
      portal: "user",
      metadata: { source: "verifyMobileEmailOtp", newUser: true },
    });
    await safeCreateAuthAudit({
      req,
      user,
      provider: "mobile_email_otp",
      portal: "user",
      eventType: "TOKEN_ISSUED",
      outcome: "SUCCESS",
      sessionId: user.activeSessionId,
      message: "New user created via mobile email OTP",
    });

    return res.status(201).json({
      success: true,
      message: "Account created",
      data: buildMobileAuthResponseData(user, token, true),
    });
  } catch (error) {
    console.error("verifyMobileEmailOtp error:", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Mobile: finish onboarding (name, sports, optional profile photo)
// @route   POST /api/auth/mobile/complete-onboarding
// @access  Private
export const completeMobileOnboarding = async (req, res) => {
  try {
    if (String(req.user.role || "").toLowerCase() !== "player") {
      return res.status(403).json({
        success: false,
        message: "This onboarding is only available for player accounts.",
      });
    }

    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const sportIds = Array.isArray(req.body?.sportIds) ? req.body.sportIds : [];
    const profilePhoto =
      req.body?.profilePhoto !== undefined
        ? String(req.body.profilePhoto || "").trim()
        : undefined;

    if (firstName.length < 1 || lastName.length < 1) {
      return res.status(400).json({
        success: false,
        message: "First and last name are required",
      });
    }
    if (sportIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Select at least one sport",
      });
    }

    const normalizedSportIds = [];
    const seen = new Set();
    for (const id of sportIds) {
      const sid = String(id || "").trim();
      if (!mongoose.Types.ObjectId.isValid(sid)) continue;
      if (seen.has(sid)) continue;
      seen.add(sid);
      normalizedSportIds.push(sid);
    }
    if (normalizedSportIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "One or more sport ids are invalid",
      });
    }

    const sportDocs = await Sport.find({
      _id: { $in: normalizedSportIds },
      isActive: true,
    })
      .select("_id name")
      .lean();

    if (sportDocs.length !== normalizedSportIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more sports are invalid or inactive",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.sportsInterests = normalizedSportIds;
    if (profilePhoto !== undefined) {
      user.profilePhoto = profilePhoto;
    }
    await user.save();

    await upsertPlayerProfileForUser({
      user,
      firstName,
      lastName,
      photo: profilePhoto !== undefined ? profilePhoto : user.profilePhoto || "",
    });

    let player = await Player.findOne({ user: user._id }).sort({
      isActive: -1,
      updatedAt: -1,
    });
    if (player) {
      player.name = `${firstName} ${lastName}`.trim();
      if (profilePhoto !== undefined) player.photo = profilePhoto;
      player.sports = sportDocs.map((s) => ({
        sport: s._id,
        sportName: String(s.name || ""),
        position: "",
        jerseyNumber: null,
        level: "",
      }));
      await player.save();
    }

    const fresh = await User.findById(user._id).select("-password");
    const out = fresh.toObject();
    return res.json({
      success: true,
      message: "Profile saved",
      data: {
        ...out,
        needsOnboarding: false,
        isEmailVerified: getEmailVerificationStatus(fresh),
        isPhoneVerified: getPhoneVerificationStatus(fresh),
      },
    });
  } catch (error) {
    console.error("completeMobileOnboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select("-password");
    if (user) {
      const accountRole = String(user.role || "").toLowerCase();
      if (accountRole === "superadmin" || accountRole === "scorer") {
        if (user.activeRole !== accountRole) user.activeRole = accountRole;
        if (user.baseRole !== accountRole) user.baseRole = accountRole;
      }
      await syncUserRoleSubscriptionSnapshot(user);
      if (user.isModified()) {
        await user.save();
      }
    }
    if (user && String(user.activeRole || user.role || "").toLowerCase() === "organizer") {
      user = await User.findById(user._id)
        .select("-password")
        .populate("organizerSports", "name slug description");
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get role catalog (id + name)
// @route   GET /api/auth/roles
// @access  Private
export const getRoleCatalog = async (req, res) => {
  try {
    const roles = await Role.find({})
      .select("_id name displayName")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Get role catalog error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Switch active role for unlocked user roles
// @route   POST /api/auth/switch-role
// @access  Private
export const switchRole = async (req, res) => {
  try {
    const targetRoleName = String(req.body?.role || "").trim().toLowerCase();
    const targetRoleRef = req.body?.roleRef || req.body?.roleId || null;
    if (!targetRoleName && !targetRoleRef) {
      return res.status(400).json({
        success: false,
        message: "role or roleRef is required",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const roleDoc = targetRoleRef
      ? await Role.findById(targetRoleRef).select("_id name permissions").lean()
      : await Role.findOne({ name: targetRoleName }).select("_id name permissions").lean();
    if (!roleDoc) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const normalizedTarget = String(roleDoc.name || "").toLowerCase();
    const unlocked = Array.isArray(user.unlockedRoles) ? user.unlockedRoles : [];
    const canSwitch =
      normalizedTarget === String(user.baseRole || "").toLowerCase() ||
      unlocked.some(
        (entry) =>
          String(entry?.role || "").toLowerCase() === normalizedTarget &&
          Number(entry?.unlockFlag ?? 1) === 1
      );
    if (!canSwitch) {
      return res.status(403).json({
        success: false,
        message: "Role is not unlocked for this user",
      });
    }

    if (normalizedTarget === "coach") {
      const coachProfile = await ensureCoachProfileForUser(user);
      if (coachProfile?._id) {
        user.coachProfile = coachProfile._id;
      }
    }
    if (normalizedTarget === "academyadmin") {
      let academy = null;
      if (user.academyId) {
        academy = await SportsAcademy.findById(user.academyId).select("_id adminUser").lean();
      }
      if (!academy) {
        academy = await SportsAcademy.findOne({ adminUser: user._id }).select("_id adminUser").lean();
      }
      if (!academy?._id) {
        return res.status(400).json({
          success: false,
          code: "ACADEMY_PROFILE_REQUIRED",
          message: "Academy profile not found. Unlock academy role with academy name first.",
        });
      }
      if (!user.academyId || String(user.academyId) !== String(academy._id)) {
        user.academyId = academy._id;
      }
    }

    user.role = normalizedTarget;
    user.activeRole = normalizedTarget;
    user.roleRef = roleDoc._id;
    user.permissionRefs = Array.isArray(roleDoc.permissions) ? roleDoc.permissions : [];
    await syncUserRoleSubscriptionSnapshot(user);
    await user.save();

    const refreshed = await User.findById(user._id).select("-password");
    return res.status(200).json({
      success: true,
      message: "Active role switched successfully",
      data: refreshed,
    });
  } catch (error) {
    console.error("Switch role error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Logout current user session
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    const currentSessionId = req.user?.activeSessionId || null;
    await User.findByIdAndUpdate(req.user._id, { activeSessionId: null });
    await safeEndSessionHistory({
      userId: req.user._id,
      sessionId: currentSessionId,
      reason: "LOGOUT",
    });
    await safeCreateAuthAudit({
      req,
      user: req.user,
      provider: "system",
      portal: req.user?.role === "superadmin" ? "admin" : "user",
      eventType: "LOGOUT",
      outcome: "SUCCESS",
      sessionId: currentSessionId,
      message: "User logged out",
    });
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    await safeCreateAuthAudit({
      req,
      user: req.user,
      provider: "system",
      portal: req.user?.role === "superadmin" ? "admin" : "user",
      eventType: "LOGOUT",
      outcome: "FAILED",
      reasonCode: "SERVER_ERROR",
      message: "Server error during logout",
    });
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
