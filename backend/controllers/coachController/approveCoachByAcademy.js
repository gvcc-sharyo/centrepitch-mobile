import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import ApprovalLog from "../../models/ApprovalLog.js";
import { mirrorApprovalToEntityCollection } from "../../utils/entityAuditStores.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * @desc    Approve coach by academy admin
 * @route   PUT /api/coaches/:id/approve-academy
 * @access  Private/AcademyAdmin
 */
export const approveCoachByAcademy = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Academy admin can only approve ACADEMY_COACH or BOTH types
    if (coach.coachType !== "ACADEMY_COACH" && coach.coachType !== "BOTH") {
      return res.status(400).json({
        success: false,
        message: "Freelancer coaches can only be approved by Super Admin",
      });
    }

    if (coach.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Coach is already approved",
      });
    }

    if (coach.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Coach is not pending approval (current status: ${coach.status})`,
      });
    }

    // Get user credentials from metadata
    const userEmail = coach.metadata.get("pendingUserEmail");
    const userPassword = coach.metadata.get("pendingUserPassword");
    const googleId = coach.metadata.get("googleId");
    const addressStr = coach.metadata.get("address");

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
    coach.academyApprovedBy = req.user._id;
    coach.academyApprovedAt = Date.now();
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
    coach.metadata.delete("pendingUserPassword");
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
      notes: "Approved by Academy Admin - User account created",
    });
    await mirrorApprovalToEntityCollection({
      entityType: "COACH",
      entityId: coach._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      notes: "Approved by Academy Admin - User account created",
    });

    const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() || "Coach";
    const otpTemplate = emailTemplates.otpVerification(emailOtp, coachName);
    await sendEmail({
      to: userEmail,
      subject: otpTemplate.subject,
      html: otpTemplate.html,
    });

    res.status(200).json({
      success: true,
      message: "Coach approved successfully by Academy Admin",
      data: coach,
    });
  } catch (error) {
    console.error("Approve coach by academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving coach",
      error: error.message,
    });
  }
};