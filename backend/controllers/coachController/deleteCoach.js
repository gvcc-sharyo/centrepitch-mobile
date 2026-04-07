import Coach from "../../models/Coach.js";

/**
 * @desc    Delete coach (Soft delete)
 * @route   DELETE /api/coaches/:id
 * @access  Private/SuperAdmin
 */
export const deleteCoach = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    coach.isActive = false;
    await coach.save();

    res.status(200).json({
      success: true,
      message: "Coach deactivated successfully",
    });
  } catch (error) {
    console.error("Delete coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting coach",
      error: error.message,
    });
  }
};