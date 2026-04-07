import Coach from "../../models/Coach.js";

/**
 * @desc    Get all approved coaches (Public)
 * @route   GET /api/coaches/public
 * @access  Public
 */
export const getPublicCoaches = async (req, res) => {
  try {
    const { sport, academy, coachType, search, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    let query = { status: "APPROVED", isActive: true };

    if (sport) {
      query["specialization"] = sport;
    }

    if (academy) {
      query.academies = { $elemMatch: { academy, status: "APPROVED" } };
    }

    if (coachType) {
      query.coachType = coachType.toUpperCase();
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { bio: { $regex: search, $options: "i" } },
      ];
    }

    const totalRecords = await Coach.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const coaches = await Coach.find(query)
      .populate("academies.academy", "name logo")
      .populate("userId", "profilePhoto")
      .select("-kycDocuments -metadata")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ averageRating: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coaches.length,
      totalRecords,
      totalPages,
      currentPage: pageNum,
      perPage: limitNum,
      data: coaches,
    });
  } catch (error) {
    console.error("Get public coaches error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coaches",
      error: error.message,
    });
  }
};
