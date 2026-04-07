import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import ApprovalLog from "../../models/ApprovalLog.js";

/**
 * @desc    Deactivate coach (Super Admin)
 * @route   PUT /api/coaches/:id/deactivate
 * @access  Private/SuperAdmin
 */
export const deactivateCoach = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Deactivation reason is required",
      });
    }

    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    if (!coach.isActive) {
      return res.status(400).json({
        success: false,
        message: "Coach is already deactivated",
      });
    }

    const previousStatus = coach.status;
    coach.isActive = false;
    coach.status = "SUSPENDED";
    coach.isAvailableForBooking = false;
    await coach.save();

    // Deactivate user account if exists
    if (coach.userId) {
      await User.findByIdAndUpdate(coach.userId, { isActive: false });
    }

    await ApprovalLog.createLog({
      entityType: "COACH",
      entityId: coach._id,
      action: "SUSPENDED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus,
      newStatus: "SUSPENDED",
      reason,
    });

    res.status(200).json({
      success: true,
      message: "Coach deactivated successfully",
      data: coach,
    });
  } catch (error) {
    console.error("Deactivate coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error deactivating coach",
      error: error.message,
    });
  }
};