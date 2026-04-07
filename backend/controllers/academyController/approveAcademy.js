import SportsAcademy from "../../models/SportsAcademy.js";
import User from "../../models/User.js";
import ApprovalLog from "../../models/ApprovalLog.js";
import KYC from "../../models/Kyc.js";
import { mirrorApprovalToEntityCollection, mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const normalizePhone = (phone = "") => String(phone || "").trim();

const normalizeStatus = (value = "") => String(value).trim().toUpperCase();
const getMeta = (academy, key) => academy?.metadata?.get?.(key) ?? academy?.metadata?.[key];

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

const applyAcademyKycReview = async ({ academyId, reviewerId, kycReview = [] }) => {
  const kycDoc = await KYC.findOne({ entityType: "ACADEMY", entityId: academyId });
  if (!kycDoc) return { found: false };

  let reviewedCount = 0;
  const reviewEntries = Array.isArray(kycReview) ? kycReview : [];

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

  const previousOverallStatus = kycDoc.overallStatus;
  kycDoc.overallStatus = overallStatus;
  if (overallStatus === "VERIFIED") {
    kycDoc.verifiedBy = reviewerId;
    kycDoc.verifiedAt = new Date();
  }

  await kycDoc.save();
  await mirrorKycToEntityCollection("ACADEMY", kycDoc);

  return {
    found: true,
    reviewedCount,
    overallStatus,
    previousOverallStatus,
  };
};

export const approveAcademy = async (req, res) => {
  try {
    const kycReview = Array.isArray(req.body?.kycReview) ? req.body.kycReview : [];
    const hasKycReview = kycReview.length > 0;
    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    if (academy.status === "APPROVED" && !hasKycReview) {
      return res.status(400).json({
        success: false,
        message: "Academy is already approved",
      });
    }

    // If already approved, allow KYC-only review updates from modal
    if (academy.status === "APPROVED" && hasKycReview) {
      const kycUpdate = await applyAcademyKycReview({
        academyId: academy._id,
        reviewerId: req.user._id,
        kycReview,
      });

      if (!kycUpdate.found) {
        return res.status(404).json({
          success: false,
          message: "KYC record not found for this academy",
        });
      }

      const previousKycStatus = academy.kycStatus;
      academy.kycStatus = kycUpdate.overallStatus;
      await academy.save();

      await ApprovalLog.createLog({
        entityType: "ACADEMY",
        entityId: academy._id,
        action: kycUpdate.overallStatus === "REJECTED" ? "REJECTED" : "APPROVED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus: previousKycStatus,
        newStatus: kycUpdate.overallStatus,
        notes: `KYC reviewed: ${kycUpdate.reviewedCount} documents processed`,
        metadata: { scope: "KYC_REVIEW" },
      });
      await mirrorApprovalToEntityCollection({
        entityType: "ACADEMY",
        entityId: academy._id,
        action: kycUpdate.overallStatus === "REJECTED" ? "REJECTED" : "APPROVED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus: previousKycStatus,
        newStatus: kycUpdate.overallStatus,
        notes: `KYC reviewed: ${kycUpdate.reviewedCount} documents processed`,
        metadata: { scope: "KYC_REVIEW" },
      });

      return res.status(200).json({
        success: true,
        message: `KYC status updated to ${kycUpdate.overallStatus}`,
        data: academy,
      });
    }

    const adminFirstName = getMeta(academy, "pendingAdminFirstName");
    const adminLastName = getMeta(academy, "pendingAdminLastName");
    const adminEmail = getMeta(academy, "pendingAdminEmail");
    const adminPassword = getMeta(academy, "pendingAdminPassword");
    const adminGoogleId = getMeta(academy, "adminGoogleId");
    const pendingAdminPhone = normalizePhone(getMeta(academy, "pendingAdminPhone"));
    const fallbackAcademyPhone = normalizePhone(academy.phone);
    const adminPhone = pendingAdminPhone || fallbackAcademyPhone;

    let adminUser = null;
    let emailOtp = null;
    const hasPendingCredentials = Boolean(adminEmail && (adminPassword || adminGoogleId));
    if (academy.adminUser) {
      adminUser = await User.findById(academy.adminUser);
    }

    if (!hasPendingCredentials && !adminUser) {
      return res.status(400).json({
        success: false,
        message: "Admin credentials not found",
      });
    }

    const TRIAL_DAYS = 7;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + TRIAL_DAYS);

    if (!adminUser) {
      const adminData = {
        firstName: adminFirstName,
        lastName: adminLastName,
        email: adminEmail,
        phone: adminPhone || undefined,
        role: "academyadmin",
        isVerified: false,
        isEmailVerified: false,
        isPhoneVerified: false,
        academyId: academy._id,
        subscriptionPlan: "trial",
        trialStartDate: new Date(),
        subscriptionExpiry: trialExpiry,
      };

      if (adminGoogleId) {
        adminData.googleId = adminGoogleId;
      } else {
        adminData.password = adminPassword;
      }

      adminUser = await User.create(adminData);
      emailOtp = generateOtp();
      adminUser.emailOtp = emailOtp;
      adminUser.emailOtpExpire = Date.now() + OTP_EXPIRY_MS;
      adminUser.otp = emailOtp;
      adminUser.otpExpire = adminUser.emailOtpExpire;
      await adminUser.save();
    } else {
      if (!adminUser.academyId || String(adminUser.academyId) !== String(academy._id)) {
        adminUser.academyId = academy._id;
      }
      if (String(adminUser.role || "").toLowerCase() !== "academyadmin") {
        adminUser.role = "academyadmin";
      }
      if (adminUser.isModified()) {
        await adminUser.save();
      }
    }

    const previousStatus = academy.status;
    academy.status = "APPROVED";
    academy.approvedBy = req.user._id;
    academy.approvedAt = Date.now();
    academy.adminUser = adminUser._id;
    if (academy?.metadata?.delete) {
      academy.metadata.delete("pendingAdminPassword");
    }

    if (hasKycReview) {
      const kycUpdate = await applyAcademyKycReview({
        academyId: academy._id,
        reviewerId: req.user._id,
        kycReview,
      });
      if (kycUpdate.found) {
        academy.kycStatus = kycUpdate.overallStatus;
      }
    }

    await academy.save();

    await ApprovalLog.createLog({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      notes: "Approved by Super Admin - Admin account created",
    });
    await mirrorApprovalToEntityCollection({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      notes: "Approved by Super Admin - Admin account created",
    });

    // Send approval success email to academy admin (supports both legacy and subscription-unlock flows).
    const finalAdminEmail = adminEmail || adminUser.email;
    const adminName =
      [adminFirstName, adminLastName].filter(Boolean).join(" ").trim() ||
      [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ").trim() ||
      academy.name;
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
    const trialExpiryDate = trialExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const supportEmail = process.env.SUPPORT_EMAIL || "support@centrepitch.com";
    const emailTemplate = emailTemplates.academyApprovalSuccess(
      adminName,
      academy.name,
      loginUrl,
      trialExpiryDate,
      supportEmail
    );
    await sendEmail({
      to: finalAdminEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (emailOtp) {
      const otpTemplate = emailTemplates.otpVerification(emailOtp, adminName);
      await sendEmail({
        to: finalAdminEmail,
        subject: otpTemplate.subject,
        html: otpTemplate.html,
      });
    }

    res.status(200).json({
      success: true,
      message: "Academy approved successfully",
      data: academy,
    });
  } catch (error) {
    console.error("Approve academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving academy",
      error: error.message,
    });
  }
};

export const rejectAcademy = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    const previousStatus = academy.status;
    academy.status = "REJECTED";
    academy.rejectionReason = reason;
    academy.kycStatus = "REJECTED";

    const kycDoc = await KYC.findOne({ entityType: "ACADEMY", entityId: academy._id });
    if (kycDoc) {
      kycDoc.documents = (kycDoc.documents || []).map((doc) => ({
        ...doc.toObject(),
        verificationStatus: "REJECTED",
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        rejectionReason: reason,
      }));
      kycDoc.overallStatus = "REJECTED";
      await kycDoc.save();
      await mirrorKycToEntityCollection("ACADEMY", kycDoc);
    }

    await academy.save();

    await ApprovalLog.createLog({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "REJECTED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "REJECTED",
      notes: reason,
    });
    await mirrorApprovalToEntityCollection({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "REJECTED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "REJECTED",
      notes: reason,
      reason,
    });

    // Send rejection email to academy admin (supports both legacy and subscription-unlock flows).
    let linkedAdminUser = null;
    if (academy.adminUser) {
      linkedAdminUser = await User.findById(academy.adminUser).select("firstName lastName email").lean();
    }
    const adminEmail = getMeta(academy, "pendingAdminEmail") || linkedAdminUser?.email;
    if (adminEmail) {
      const adminFirstName = getMeta(academy, "pendingAdminFirstName") || linkedAdminUser?.firstName;
      const adminLastName = getMeta(academy, "pendingAdminLastName") || linkedAdminUser?.lastName;
      const adminName = [adminFirstName, adminLastName].filter(Boolean).join(" ").trim() || academy.name;
      const supportEmail = process.env.SUPPORT_EMAIL || "support@centrepitch.com";
      const emailTemplate = emailTemplates.academyRejection(adminName, academy.name, reason, supportEmail);
      await sendEmail({
        to: adminEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    }

    res.status(200).json({
      success: true,
      message: "Academy rejected",
      data: academy,
    });
  } catch (error) {
    console.error("Reject academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting academy",
      error: error.message,
    });
  }
};

export const deactivateAcademy = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Deactivation reason is required",
      });
    }

    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    if (!academy.isActive) {
      return res.status(400).json({
        success: false,
        message: "Academy is already deactivated",
      });
    }

    const previousStatus = academy.status;

    academy.isActive = false;
    academy.status = "SUSPENDED";
    await academy.save();

    // Deactivate the academy admin user account as well
    if (academy.adminUser) {
      await User.findByIdAndUpdate(academy.adminUser, { isActive: false });
    }

    // Log the action for audit trail
    await ApprovalLog.createLog({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "SUSPENDED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "SUSPENDED",
      reason,
    });
    await mirrorApprovalToEntityCollection({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "SUSPENDED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "SUSPENDED",
      reason,
    });

    res.status(200).json({
      success: true,
      message: "Academy deactivated successfully",
      data: academy,
    });
  } catch (error) {
    console.error("Deactivate academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error deactivating academy",
      error: error.message,
    });
  }
};

export const reactivateAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findById(req.params.id);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    if (academy.isActive && academy.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Academy is already active",
      });
    }

    const previousStatus = academy.status;

    academy.isActive = true;
    academy.status = "APPROVED";
    await academy.save();

    // Reactivate the academy admin user account
    if (academy.adminUser) {
      await User.findByIdAndUpdate(academy.adminUser, { isActive: true });
    }

    // Log the action for audit trail
    await ApprovalLog.createLog({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      reason: "Account reactivated by super admin",
    });
    await mirrorApprovalToEntityCollection({
      entityType: "ACADEMY",
      entityId: academy._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      reason: "Account reactivated by super admin",
    });

    res.status(200).json({
      success: true,
      message: "Academy reactivated successfully",
      data: academy,
    });
  } catch (error) {
    console.error("Reactivate academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error reactivating academy",
      error: error.message,
    });
  }
};
