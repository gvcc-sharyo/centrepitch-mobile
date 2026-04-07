import mongoose from "mongoose";
import Coach from "../../models/Coach.js";

/**
 * @desc    Get single coach details (Public)
 * @route   GET /api/coaches/public/:id
 * @access  Public
 */
export const getPublicCoachById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach id",
      });
    }

    const coach = await Coach.findOne({
      _id: id,
      status: "APPROVED",
      isActive: true,
    })
      .populate("academies.academy", "name logo address")
      .populate("userId", "profilePhoto")
      .select("-kycDocuments -metadata");

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
    console.error("Get public coach error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coach details",
      error: error.message,
    });
  }
};