import Coach from "../../models/Coach.js";

/**
 * @desc    Get coach by ID
 * @route   GET /api/coaches/:id
 * @access  Private
 */
export const getCoachById = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id)
      .populate("academies.academy", "name logo")
      .populate("userId", "email")
      .populate("kycDocuments", "overallStatus submittedAt documents");

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    res.status(200).json({
      success: true,
      data: coach,
    });
  } catch (error) {
    console.error("Get coach by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coach",
      error: error.message,
    });
  }
};