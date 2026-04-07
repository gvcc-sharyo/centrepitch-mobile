import Coach from "../../models/Coach.js";
import ApprovalLog from "../../models/ApprovalLog.js";
import KYC from "../../models/Kyc.js";
import { mirrorApprovalToEntityCollection, mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";

/**
 * @desc    Reject coach
 * @route   PUT /api/coaches/:id/reject
 * @access  Private/SuperAdmin
 */
export const rejectCoach = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    const previousStatus = coach.status;
    coach.status = "REJECTED";
    coach.rejectionReason = reason;
    coach.kycStatus = "REJECTED";

    const kycDoc = await KYC.findOne({ entityType: "COACH", entityId: coach._id });
    if (kycDoc) {
      kycDoc.documents.forEach((doc) => {
        doc.verificationStatus = "REJECTED";
        doc.verifiedBy = req.user._id;
        doc.verifiedAt = new Date();
        doc.rejectionReason = reason;
      });
      kycDoc.overallStatus = "REJECTED";
      await kycDoc.save();
      await mirrorKycToEntityCollection("COACH", kycDoc);
    }

    await coach.save();

    // Create approval log
    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "REJECTED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "REJECTED",
      reason,
    });
    await mirrorApprovalToEntityCollection({
      entityType: "COACH",
      entityId: coach._id,
      action: "REJECTED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "REJECTED",
      reason,
      notes: reason,
    });

    // Send rejection email to coach
    const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() || "Coach";
    const supportEmail = process.env.SUPPORT_EMAIL || "support@centrepitch.com";
    const emailTemplate = emailTemplates.coachRejection(coachName, reason, supportEmail);
    await sendEmail({
      to: coach.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    res.status(200).json({
      success: true,
      message: "Coach rejected",
      data: coach,
    });
  } catch (error) {
    console.error("Reject coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting coach",
      error: error.message,
    });
  }
};