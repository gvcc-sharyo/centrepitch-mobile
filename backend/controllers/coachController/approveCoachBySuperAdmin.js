import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import ApprovalLog from "../../models/ApprovalLog.js";
import KYC from "../../models/Kyc.js";
import { mirrorApprovalToEntityCollection, mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const normalizeStatus = (value = "") => String(value).trim().toUpperCase();

const toKycDocStatus = (reviewStatus = "") => {
  const status = normalizeStatus(reviewStatus);
  if (status === "APPROVED" || status === "VERIFIED" || status === "VALID") return "VERIFIED";
  if (status === "REJECTED" || status === "INVALID") return "REJECTED";
  return null;
};

const findReviewForDoc = (doc, reviews = []) => {
  const normalizedDocName = String(doc.documentName || "").trim().toLowerCase();
  const normalizedType = normalizeStatus(doc.documentType || "");

  return reviews.find((review) => {
    if (!review) return false;
    if (review.url && review.url === doc.documentUrl) return true;
    if (review.documentUrl && review.documentUrl === doc.documentUrl) return true;

    const reviewName = String(review.documentName || review.label || "").trim().toLowerCase();
    if (reviewName && normalizedDocName && reviewName === normalizedDocName) return true;

    const reviewType = normalizeStatus(review.documentType || "");
    if (reviewType && normalizedType && reviewType === normalizedType) return true;

    const key = String(review.key || "");
    if (key && ((doc.documentUrl && key.includes(doc.documentUrl)) || (doc.documentName && key.includes(doc.documentName)))) {
      return true;
    }

    return false;
  });
};

const applyCoachKycReview = async ({ coach, reviewerId, kycReview = [] }) => {
  const kycDoc = await KYC.findOne({ entityType: "COACH", entityId: coach._id });
  if (!kycDoc) return { found: false };

  const reviewEntries = Array.isArray(kycReview) ? kycReview : [];
  let reviewedCount = 0;

  kycDoc.documents.forEach((doc, index) => {
    const matched = findReviewForDoc(doc, reviewEntries) || reviewEntries[index];
    if (!matched) return;

    const nextStatus = toKycDocStatus(matched.status);
    if (!nextStatus) return;

    reviewedCount += 1;
    doc.verificationStatus = nextStatus;
    doc.verifiedBy = reviewerId;
    doc.verifiedAt = new Date();
    doc.rejectionReason = nextStatus === "REJECTED" ? (matched.note || matched.reason || "") : "";
  });

  const docs = kycDoc.documents || [];
  let overallStatus = "INCOMPLETE";
  if (docs.length > 0) {
    const allVerified = docs.every((d) => d.verificationStatus === "VERIFIED");
    const anyRejected = docs.some((d) => d.verificationStatus === "REJECTED");
    if (allVerified) overallStatus = "VERIFIED";
    else if (anyRejected) overallStatus = "REJECTED";
    else overallStatus = "PENDING";
  }

  kycDoc.overallStatus = overallStatus;
  if (overallStatus === "VERIFIED") {
    kycDoc.verifiedBy = reviewerId;
    kycDoc.verifiedAt = new Date();
  }
  await kycDoc.save();
  await mirrorKycToEntityCollection("COACH", kycDoc);

  coach.kycStatus = overallStatus;
  if (coach.kycDocuments?.toString() !== kycDoc._id.toString()) {
    coach.kycDocuments = kycDoc._id;
  }

  return { found: true, reviewedCount, overallStatus };
};

/**
 * @desc    Approve coach by super admin
 * @route   PUT /api/coaches/:id/approve-admin
 * @access  Private/SuperAdmin
 */
export const approveCoachBySuperAdmin = async (req, res) => {
  try {
    const kycReview = Array.isArray(req.body?.kycReview) ? req.body.kycReview : [];
    const hasKycReview = kycReview.length > 0;
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    if (coach.status === "APPROVED" && !hasKycReview) {
      return res.status(400).json({
        success: false,
        message: "Coach is already approved",
      });
    }

    if (coach.status === "APPROVED" && hasKycReview) {
      const kycUpdate = await applyCoachKycReview({
        coach,
        reviewerId: req.user._id,
        kycReview,
      });
      if (!kycUpdate.found) {
        return res.status(404).json({
          success: false,
          message: "KYC record not found for this coach",
        });
      }

      await coach.save();

      await ApprovalLog.createLog({
        entityType: "COACH",
        entityId: coach._id,
        action: kycUpdate.overallStatus === "REJECTED" ? "REJECTED" : "APPROVED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus: "PENDING",
        newStatus: kycUpdate.overallStatus,
        notes: `KYC reviewed: ${kycUpdate.reviewedCount} documents processed`,
      });
      await mirrorApprovalToEntityCollection({
        entityType: "COACH",
        entityId: coach._id,
        action: kycUpdate.overallStatus === "REJECTED" ? "REJECTED" : "APPROVED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus: "PENDING",
        newStatus: kycUpdate.overallStatus,
        notes: `KYC reviewed: ${kycUpdate.reviewedCount} documents processed`,
        metadata: { scope: "KYC_REVIEW" },
      });

      return res.status(200).json({
        success: true,
        message: `KYC status updated to ${kycUpdate.overallStatus}`,
        data: coach,
      });
    }

    if (coach.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Coach is not pending approval (current status: ${coach.status})`,
      });
    }

    // Re-approval path: coach user account already exists (e.g., rejected then re-submitted KYC).
    // Do not attempt to recreate user from pending metadata.
    if (coach.userId) {
      const previousStatus = coach.status;
      coach.status = "APPROVED";
      coach.superAdminApprovedBy = req.user._id;
      coach.superAdminApprovedAt = Date.now();
      coach.isAvailableForBooking = true;
      coach.rejectionReason = "";

      if (coach.academies && coach.academies.length > 0) {
        coach.academies.forEach((entry) => {
          if (entry.status === "PENDING") {
            entry.status = "APPROVED";
            entry.joinedAt = new Date();
          }
        });
      }

      let kycUpdate = null;
      if (hasKycReview) {
        kycUpdate = await applyCoachKycReview({
          coach,
          reviewerId: req.user._id,
          kycReview,
        });
      }

      await coach.save();

      const resultingStatus = kycUpdate?.overallStatus || "APPROVED";
      const action = resultingStatus === "REJECTED" ? "REJECTED" : "APPROVED";
      const notes = kycUpdate
        ? `KYC reviewed: ${kycUpdate.reviewedCount} documents processed`
        : "Re-approved by Super Admin";

      await ApprovalLog.createLog({
        entityType: "COACH",
        entityId: coach._id,
        action,
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus,
        newStatus: resultingStatus,
        notes,
      });
      await mirrorApprovalToEntityCollection({
        entityType: "COACH",
        entityId: coach._id,
        action,
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus,
        newStatus: resultingStatus,
        notes,
        metadata: { scope: "REAPPROVAL" },
      });

      return res.status(200).json({
        success: true,
        message: resultingStatus === "REJECTED"
          ? "KYC reviewed and remains rejected"
          : "Coach approved successfully by Super Admin",
        data: coach,
      });
    }

    // Get user credentials from metadata
    const userEmail = coach.metadata?.get?.("pendingUserEmail");
    const userPassword = coach.metadata?.get?.("pendingUserPassword");
    const googleId = coach.metadata?.get?.("googleId");
    const addressStr = coach.metadata?.get?.("address");

    if (!userEmail || (!userPassword && !googleId)) {
      return res.status(400).json({
        success: false,
        message: "User credentials not found in coach metadata",
      });
    }

    let address = {};
    try {
      if (addressStr) address = JSON.parse(addressStr);
    } catch (e) {
      // ignore parse error
    }

    const TRIAL_DAYS = 7;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + TRIAL_DAYS);

    const userData = {
      firstName: coach.firstName,
      lastName: coach.lastName,
      email: userEmail,
      phone: coach.phone,
      role: "coach",
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
      coachProfile: coach._id,
      address,
      subscriptionPlan: "trial",
      trialStartDate: new Date(),
      subscriptionExpiry: trialExpiry,
    };

    if (googleId) {
      userData.googleId = googleId;
    } else {
      userData.password = userPassword;
    }

    const user = await User.create(userData);
    const emailOtp = generateOtp();
    user.emailOtp = emailOtp;
    user.emailOtpExpire = Date.now() + OTP_EXPIRY_MS;
    user.otp = emailOtp;
    user.otpExpire = user.emailOtpExpire;
    await user.save();

    // Update coach
    const previousStatus = coach.status;
    coach.status = "APPROVED";
    coach.userId = user._id;
    coach.superAdminApprovedBy = req.user._id;
    coach.superAdminApprovedAt = Date.now();
    coach.isAvailableForBooking = true;

    // Also approve any PENDING academy memberships
    if (coach.academies && coach.academies.length > 0) {
      coach.academies.forEach((entry) => {
        if (entry.status === "PENDING") {
          entry.status = "APPROVED";
          entry.joinedAt = new Date();
        }
      });
    }

    // Clear sensitive metadata
    coach.metadata?.delete?.("pendingUserPassword");

    if (hasKycReview) {
      await applyCoachKycReview({
        coach,
        reviewerId: req.user._id,
        kycReview,
      });
    }

    await coach.save();

    // Create approval log
    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      notes: "Approved by Super Admin - User account created",
    });
    await mirrorApprovalToEntityCollection({
      entityType: "COACH",
      entityId: coach._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      notes: "Approved by Super Admin - User account created",
    });

    // Send approval success email to coach
    const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() || "Coach";
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
    const trialExpiryDate = trialExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const supportEmail = process.env.SUPPORT_EMAIL || "support@centrepitch.com";
    const emailTemplate = emailTemplates.coachApprovalSuccess(coachName, loginUrl, trialExpiryDate, supportEmail);
    await sendEmail({
      to: userEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    const otpTemplate = emailTemplates.otpVerification(emailOtp, coachName);
    await sendEmail({
      to: userEmail,
      subject: otpTemplate.subject,
      html: otpTemplate.html,
    });

    res.status(200).json({
      success: true,
      message: "Coach approved successfully by Super Admin",
      data: coach,
    });
  } catch (error) {
    console.error("Approve coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving coach",
      error: error.message,
    });
  }
};