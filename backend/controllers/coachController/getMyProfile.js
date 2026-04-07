import Coach from "../../models/Coach.js";
import CoachStudentRelation from "../../models/CoachStudentRelation.js";

/**
 * @desc    Get my profile (Coach)
 * @route   GET /api/coaches/my
 * @access  Private/Coach
 */
export const getMyProfile = async (req, res) => {
  try {
    const coach = await Coach.findOne({ userId: req.user._id })
      .populate("academies.academy", "name logo address")
      .populate("userId", "email phone");

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const relations = await CoachStudentRelation.find({ coach: coach._id })
      .select("player status sessionsCompleted");

    const activePlayerIds = new Set(
      relations
        .filter((r) => r.status === "active")
        .map((r) => String(r.player))
    );
    const totalStudentsTaught = activePlayerIds.size;
    const totalSessionsConducted = relations
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + (r.sessionsCompleted || 0), 0);

    const coachData = coach.toObject();
    coachData.totalStudentsTaught = totalStudentsTaught;
    coachData.totalSessionsConducted = totalSessionsConducted;

    res.status(200).json({
      success: true,
      data: coachData,
    });
  } catch (error) {
    console.error("Get my profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};