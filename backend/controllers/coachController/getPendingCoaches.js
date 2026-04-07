import Coach from "../../models/Coach.js";

/**
 * @desc    Get pending coaches (Super Admin)
 * @route   GET /api/coaches/pending
 * @access  Private/SuperAdmin
 */
export const getPendingCoaches = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    // Show only coaches who have submitted KYC (hide incomplete registrations)
    let query = {
      status: "PENDING",
      kycStatus: "PENDING",
    };

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
      .populate("academies.academy", "name")
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: 1 });

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
    console.error("Get pending coaches error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending coaches",
      error: error.message,
    });
  }
};