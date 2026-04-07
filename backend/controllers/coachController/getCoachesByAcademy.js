import Coach from "../../models/Coach.js";

/**
 * @desc    Get coaches by academy
 * @route   GET /api/coaches/academy/:academyId
 * @access  Private/AcademyAdmin or SuperAdmin
 */
export const getCoachesByAcademy = async (req, res) => {
  try {
    const { academyId } = req.params;
    const { status, search, page = 1, limit = 10, membership } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(10000, parseInt(limit)));

    const validStatuses = ["PENDING", "APPROVED", "REJECTED", "REMOVED"];
    const elemMatch = { academy: academyId };
    if (membership && validStatuses.includes(membership.toUpperCase())) {
      const ms = membership.toUpperCase();
      // Support legacy ACTIVE entries as APPROVED
      elemMatch.status = ms === "APPROVED" ? { $in: ["APPROVED", "ACTIVE"] } : ms;
    }
    let query = { academies: { $elemMatch: elemMatch } };

    if (status) {
      query.status = status.toUpperCase();
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
      .populate("userId", "email phone")
      .populate("academies.academy", "name logo address")
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
    console.error("Get coaches by academy error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coaches",
      error: error.message,
    });
  }
};
