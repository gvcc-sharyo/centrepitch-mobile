import Coach from "../../models/Coach.js";

/**
 * @desc    Get all coaches (Super Admin)
 * @route   GET /api/coaches
 * @access  Private/SuperAdmin
 */
export const getAllCoaches = async (req, res) => {
  try {
    const { status, coachType, search, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    let query = {};

    if (status) {
      query.status = status.toUpperCase();
      // Pending coaches can be either KYC submitted (PENDING) or not submitted yet (INCOMPLETE).
      if (query.status === "PENDING") {
        query.kycStatus = { $in: ["PENDING", "INCOMPLETE"] };
      }
    }

    if (coachType) {
      query.coachType = coachType.toUpperCase();
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalRecords = await Coach.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const coaches = await Coach.find(query)
      .populate("academies.academy", "name logo")
      .populate("userId", "email")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

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
    console.error("Get all coaches error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coaches",
      error: error.message,
    });
  }
};
