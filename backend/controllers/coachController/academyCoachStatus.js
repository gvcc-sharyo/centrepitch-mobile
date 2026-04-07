import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import SportsAcademy from "../../models/SportsAcademy.js";
import ApprovalLog from "../../models/ApprovalLog.js";
import JoinRequest from "../../models/JoinRequest.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * @desc    Approve a pending coach in the academy (full approval — creates User account if needed)
 * @route   PUT /api/coaches/:id/approve-in-academy
 * @access  Private (Academy Admin)
 */
export const approveCoachInAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const coach = await Coach.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const entry = coach.academies.find(
      (a) => a.academy.toString() === academy._id.toString() && a.status === "PENDING"
    );

    if (!entry) {
      return res.status(400).json({ success: false, message: "No pending request found for this coach" });
    }

    // Approve academy membership
    entry.status = "APPROVED";
    entry.joinedAt = new Date();
    entry.removedAt = undefined;

    if (coach.coachType === "FREELANCER") {
      coach.coachType = "BOTH";
    }

    // If the coach's global status is still PENDING, do a full approval (create User account)
    if (coach.status === "PENDING") {
      const userEmail = coach.metadata?.get("pendingUserEmail");
      const userPassword = coach.metadata?.get("pendingUserPassword");
      const googleId = coach.metadata?.get("googleId");
      const addressStr = coach.metadata?.get("address");

      if (!userEmail || (!userPassword && !googleId)) {
        return res.status(400).json({
          success: false,
          message: "User credentials not found in coach metadata. Cannot create user account.",
        });
      }

      let address = {};
      try {
        if (addressStr) address = JSON.parse(addressStr);
      } catch (e) {}

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

      const previousStatus = coach.status;
      coach.status = "APPROVED";
      coach.userId = user._id;
      coach.academyApprovedBy = req.user._id;
      coach.academyApprovedAt = new Date();
      coach.isAvailableForBooking = true;

      coach.metadata.delete("pendingUserPassword");

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

      const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() || "Coach";
      const otpTemplate = emailTemplates.otpVerification(emailOtp, coachName);
      await sendEmail({
        to: userEmail,
        subject: otpTemplate.subject,
        html: otpTemplate.html,
      });
    }

    await coach.save();

    await JoinRequest.updateMany(
      { coach: coach._id, academy: academy._id, status: "PENDING" },
      { status: "APPROVED", reviewedBy: req.user._id, reviewedAt: new Date() }
    );

    res.json({
      success: true,
      message: "Coach approved and added to your academy",
      data: { coachId: coach._id, academyId: academy._id, status: "APPROVED", globalStatus: coach.status },
    });
  } catch (error) {
    console.error("Approve coach in academy error:", error);
    res.status(500).json({ success: false, message: "Error approving coach", error: error.message });
  }
};

/**
 * @desc    Reject a pending coach in the academy (also rejects globally if still PENDING)
 * @route   PUT /api/coaches/:id/reject-in-academy
 * @access  Private (Academy Admin)
 */
export const rejectCoachInAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const coach = await Coach.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const entryIndex = coach.academies.findIndex(
      (a) => a.academy.toString() === academy._id.toString() && a.status === "PENDING"
    );

    if (entryIndex === -1) {
      return res.status(400).json({ success: false, message: "No pending request found for this coach" });
    }

    const { reason } = req.body || {};

    coach.academies.splice(entryIndex, 1);

    const approvedCount = coach.academies.filter((a) => a.status === "APPROVED" || a.status === "ACTIVE").length;
    if (approvedCount === 0 && (coach.coachType === "BOTH" || coach.coachType === "ACADEMY_COACH")) {
      coach.coachType = "FREELANCER";
    }

    // If the coach's global status is still PENDING, reject globally too
    if (coach.status === "PENDING") {
      const previousStatus = coach.status;
      coach.status = "REJECTED";
      if (reason) coach.rejectionReason = reason;

      await ApprovalLog.createLog({
        entityType: "COACH",
        entityId: coach._id,
        action: "REJECTED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus,
        newStatus: "REJECTED",
        notes: reason || "Rejected by Academy Admin",
      });
    } else {
      await ApprovalLog.createLog({
        entityType: "COACH",
        entityId: coach._id,
        action: "REJECTED",
        actionBy: req.user._id,
        actionByRole: req.user.role,
        previousStatus: "PENDING",
        newStatus: "REMOVED",
        notes: `Join request rejected for academy: ${academy.name || academy._id}${reason ? ` - ${reason}` : ""}`,
      });
    }

    await coach.save();

    await JoinRequest.updateMany(
      { coach: coach._id, academy: academy._id, status: "PENDING" },
      { status: "REJECTED", rejectionReason: reason || "", reviewedBy: req.user._id, reviewedAt: new Date() }
    );

    res.json({
      success: true,
      message: "Coach join request rejected",
      data: { coachId: coach._id, academyId: academy._id, coachType: coach.coachType, globalStatus: coach.status },
    });
  } catch (error) {
    console.error("Reject coach in academy error:", error);
    res.status(500).json({ success: false, message: "Error rejecting coach", error: error.message });
  }
};

/**
 * @desc    Remove an approved coach from academy
 * @route   PUT /api/coaches/:id/remove-from-academy
 * @access  Private (Academy Admin)
 */
export const removeCoachFromAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const coach = await Coach.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const entryIndex = coach.academies.findIndex(
      (a) => a.academy.toString() === academy._id.toString()
    );

    if (entryIndex === -1) {
      return res.status(400).json({ success: false, message: "Coach is not associated with your academy" });
    }

    const previousMembershipStatus = coach.academies[entryIndex].status;
    coach.academies.splice(entryIndex, 1);

    const approvedCount = coach.academies.filter((a) => a.status === "APPROVED" || a.status === "ACTIVE").length;
    if (approvedCount === 0 && (coach.coachType === "BOTH" || coach.coachType === "ACADEMY_COACH")) {
      coach.coachType = "FREELANCER";
    }

    await coach.save();

    await JoinRequest.updateMany(
      { coach: coach._id, academy: academy._id },
      { status: "REJECTED", rejectionReason: "Removed from academy", reviewedBy: req.user._id, reviewedAt: new Date() }
    );

    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "REVOKED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus: previousMembershipStatus,
      newStatus: "REMOVED",
      notes: `Removed from academy: ${academy.name || academy._id}`,
    });

    res.json({
      success: true,
      message: "Coach has been removed from your academy",
      data: { coachId: coach._id, academyId: academy._id, coachType: coach.coachType },
    });
  } catch (error) {
    console.error("Remove coach from academy error:", error);
    res.status(500).json({ success: false, message: "Error removing coach from academy" });
  }
};

/**
 * @desc    Reactivate a previously removed coach
 * @route   PUT /api/coaches/:id/reactivate-in-academy
 * @access  Private (Academy Admin)
 */
export const reactivateCoachInAcademy = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const coach = await Coach.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const approvedCount = coach.academies.filter((a) => a.status === "APPROVED" || a.status === "ACTIVE").length;
    if (approvedCount >= 3) {
      return res.status(400).json({ success: false, message: "Coach has already reached the maximum of 3 approved academies" });
    }

    const existingEntry = coach.academies.find(
      (a) => a.academy.toString() === academy._id.toString()
    );

    if (existingEntry) {
      if (existingEntry.status === "APPROVED" || existingEntry.status === "ACTIVE") {
        return res.status(400).json({ success: false, message: "Coach is already active in your academy" });
      }
      existingEntry.status = "APPROVED";
      existingEntry.joinedAt = new Date();
      existingEntry.removedAt = undefined;
    } else {
      coach.academies.push({
        academy: academy._id,
        status: "APPROVED",
        joinedAt: new Date(),
      });
    }

    if (coach.coachType === "FREELANCER") {
      coach.coachType = "BOTH";
    }

    await coach.save();

    await JoinRequest.updateMany(
      { coach: coach._id, academy: academy._id },
      { status: "APPROVED", reviewedBy: req.user._id, reviewedAt: new Date() }
    );

    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus: existingEntry ? "REJECTED" : "REMOVED",
      newStatus: "APPROVED",
      notes: `Reactivated in academy: ${academy.name || academy._id}`,
    });

    res.json({
      success: true,
      message: "Coach has been reactivated in your academy",
      data: { coachId: coach._id, academyId: academy._id, status: "APPROVED", coachType: coach.coachType },
    });
  } catch (error) {
    console.error("Reactivate coach in academy error:", error);
    res.status(500).json({ success: false, message: "Error reactivating coach" });
  }
};
