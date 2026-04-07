import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import ApprovalLog from "../../models/ApprovalLog.js";

/**
 * @desc    Reactivate coach (Super Admin)
 * @route   PUT /api/coaches/:id/reactivate
 * @access  Private/SuperAdmin
 */
export const reactivateCoach = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    if (coach.isActive && coach.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Coach is already active",
      });
    }

    const previousStatus = coach.status;
    coach.isActive = true;
    coach.status = "APPROVED";
    coach.isAvailableForBooking = true;
    await coach.save();

    // Reactivate user account if exists
    if (coach.userId) {
      await User.findByIdAndUpdate(coach.userId, { isActive: true });
    }

    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "APPROVED",
      reason: "Coach reactivated by super admin",
    });

    res.status(200).json({
      success: true,
      message: "Coach reactivated successfully",
      data: coach,
    });
  } catch (error) {
    console.error("Reactivate coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error reactivating coach",
      error: error.message,
    });
  }
};