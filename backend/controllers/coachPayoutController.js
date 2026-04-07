import CoachPayoutLedger from "../models/CoachPayoutLedger.js";
import SportsAcademy from "../models/SportsAcademy.js";
import Coach from "../models/Coach.js";

const findAcademyForAdmin = async (userId) => SportsAcademy.findOne({ adminUser: userId }).select("_id");
const findCoachForUser = async (userId) => Coach.findOne({ userId }).select("_id");
const ALLOWED_STATUSES = new Set(["pending", "approved", "paid", "disputed"]);
const PAYABLE_STATUSES = ["pending", "approved"];

const parseMonthRange = (monthInput = "") => {
  const raw = String(monthInput || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end, normalized: `${year}-${String(month).padStart(2, "0")}` };
};

/**
 * @desc    Academy: list coach payout ledger rows
 * @route   GET /api/coach-payouts/academy
 * @access  Private (Academy Admin)
 */
export const getAcademyCoachPayouts = async (req, res) => {
  try {
    const academy = await findAcademyForAdmin(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const { status, coach, page = 1, limit = 50 } = req.query;
    if (status && !ALLOWED_STATUSES.has(String(status))) {
      return res.status(400).json({ success: false, message: "Invalid payout status filter" });
    }
    const query = { academy: academy._id };
    if (status) query.status = status;
    if (coach) query.coach = coach;

    const total = await CoachPayoutLedger.countDocuments(query);
    const data = await CoachPayoutLedger.find(query)
      .populate("coach", "firstName lastName profilePhoto")
      .populate("session", "title type schedule ownerType billingScope")
      .sort({ occurrenceDate: -1, createdAt: -1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10));

    const totals = await CoachPayoutLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          grossAmount: { $sum: "$grossAmount" },
          academyShare: { $sum: "$academyShare" },
          coachShare: { $sum: "$coachShare" },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      data,
      totals: totals[0] || {
        grossAmount: 0,
        academyShare: 0,
        coachShare: 0,
        pendingCount: 0,
        approvedCount: 0,
        paidCount: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching academy coach payouts" });
  }
};

/**
 * @desc    Coach: list own payouts
 * @route   GET /api/coach-payouts/coach/my
 * @access  Private (Coach)
 */
export const getCoachMyPayouts = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { status, page = 1, limit = 50 } = req.query;
    if (status && !ALLOWED_STATUSES.has(String(status))) {
      return res.status(400).json({ success: false, message: "Invalid payout status filter" });
    }
    const query = { coach: coach._id };
    if (status) query.status = status;

    const total = await CoachPayoutLedger.countDocuments(query);
    const data = await CoachPayoutLedger.find(query)
      .populate("academy", "name logo")
      .populate("session", "title type schedule")
      .sort({ occurrenceDate: -1, createdAt: -1 })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10));

    const totals = await CoachPayoutLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          receivable: {
            $sum: "$coachShare",
          },
          outstandingReceivable: {
            $sum: {
              $cond: [{ $in: ["$status", ["pending", "approved"]] }, "$coachShare", 0],
            },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$coachShare", 0],
            },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      data,
      totals: totals[0] || {
        receivable: 0,
        outstandingReceivable: 0,
        paidAmount: 0,
        pendingCount: 0,
        approvedCount: 0,
        paidCount: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching coach payouts" });
  }
};

/**
 * @desc    Academy: approve payout
 * @route   PUT /api/coach-payouts/:id/approve
 * @access  Private (Academy Admin)
 */
export const approveCoachPayout = async (req, res) => {
  try {
    const academy = await findAcademyForAdmin(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const row = await CoachPayoutLedger.findOne({ _id: req.params.id, academy: academy._id });
    if (!row) {
      return res.status(404).json({ success: false, message: "Payout row not found" });
    }
    if (row.status === "paid") {
      return res.status(400).json({ success: false, message: "Payout is already paid" });
    }
    if (row.status === "approved") {
      return res.status(200).json({ success: true, message: "Payout already approved", data: row });
    }

    row.status = "approved";
    if (req.body?.notes !== undefined) row.notes = String(req.body.notes || "");
    await row.save();

    return res.json({ success: true, message: "Payout approved", data: row });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error approving payout" });
  }
};

/**
 * @desc    Academy: mark payout paid
 * @route   PUT /api/coach-payouts/:id/pay
 * @access  Private (Academy Admin)
 */
export const payCoachPayout = async (req, res) => {
  try {
    const academy = await findAcademyForAdmin(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const row = await CoachPayoutLedger.findOne({ _id: req.params.id, academy: academy._id });
    if (!row) {
      return res.status(404).json({ success: false, message: "Payout row not found" });
    }
    if (row.status === "paid") {
      return res.status(200).json({ success: true, message: "Payout already marked paid", data: row });
    }
    const paymentRef = String(req.body?.paymentRef || "").trim();
    if (!paymentRef) {
      return res.status(400).json({
        success: false,
        message: "paymentRef is required to mark payout as paid",
      });
    }

    row.status = "paid";
    row.paidAt = new Date();
    row.paidBy = req.user._id;
    row.paymentRef = paymentRef;
    if (req.body?.notes !== undefined) row.notes = String(req.body.notes || "");
    await row.save();

    return res.json({ success: true, message: "Payout marked as paid", data: row });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error marking payout as paid" });
  }
};

/**
 * @desc    Academy: coach-wise monthly payout sheet
 * @route   GET /api/coach-payouts/academy/monthly-sheet
 * @access  Private (Academy Admin)
 */
export const getAcademyMonthlyPayoutSheet = async (req, res) => {
  try {
    const academy = await findAcademyForAdmin(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const parsed = parseMonthRange(req.query?.month);
    if (!parsed) {
      return res.status(400).json({ success: false, message: "month is required in YYYY-MM format" });
    }

    const match = {
      academy: academy._id,
      occurrenceDate: { $gte: parsed.start, $lt: parsed.end },
    };

    const rows = await CoachPayoutLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$coach",
          grossAmount: { $sum: "$grossAmount" },
          coachShare: { $sum: "$coachShare" },
          academyShare: { $sum: "$academyShare" },
          receivable: {
            $sum: {
              $cond: [{ $in: ["$status", PAYABLE_STATUSES] }, "$coachShare", 0],
            },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$coachShare", 0],
            },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
          totalRows: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "coaches",
          localField: "_id",
          foreignField: "_id",
          as: "coach",
        },
      },
      {
        $project: {
          coachId: "$_id",
          grossAmount: 1,
          coachShare: 1,
          academyShare: 1,
          receivable: 1,
          paidAmount: 1,
          pendingCount: 1,
          approvedCount: 1,
          paidCount: 1,
          totalRows: 1,
          coach: {
            $let: {
              vars: { c: { $arrayElemAt: ["$coach", 0] } },
              in: {
                _id: "$$c._id",
                firstName: "$$c.firstName",
                lastName: "$$c.lastName",
                profilePhoto: "$$c.profilePhoto",
              },
            },
          },
        },
      },
      { $sort: { receivable: -1, coachShare: -1 } },
    ]);

    const totals = rows.reduce(
      (acc, row) => {
        acc.grossAmount += Number(row.grossAmount || 0);
        acc.coachShare += Number(row.coachShare || 0);
        acc.academyShare += Number(row.academyShare || 0);
        acc.receivable += Number(row.receivable || 0);
        acc.paidAmount += Number(row.paidAmount || 0);
        acc.pendingCount += Number(row.pendingCount || 0);
        acc.approvedCount += Number(row.approvedCount || 0);
        acc.paidCount += Number(row.paidCount || 0);
        acc.totalRows += Number(row.totalRows || 0);
        return acc;
      },
      {
        grossAmount: 0,
        coachShare: 0,
        academyShare: 0,
        receivable: 0,
        paidAmount: 0,
        pendingCount: 0,
        approvedCount: 0,
        paidCount: 0,
        totalRows: 0,
      }
    );

    return res.json({
      success: true,
      month: parsed.normalized,
      range: { start: parsed.start, end: parsed.end },
      data: rows,
      totals,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching monthly payout sheet" });
  }
};

/**
 * @desc    Academy: mark monthly payouts as paid (all coaches or one coach)
 * @route   PUT /api/coach-payouts/academy/monthly-sheet/pay
 * @access  Private (Academy Admin)
 */
export const payAcademyMonthlyPayoutSheet = async (req, res) => {
  try {
    const academy = await findAcademyForAdmin(req.user._id);
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const parsed = parseMonthRange(req.body?.month);
    if (!parsed) {
      return res.status(400).json({ success: false, message: "month is required in YYYY-MM format" });
    }

    const paymentRef = String(req.body?.paymentRef || "").trim();
    if (!paymentRef) {
      return res.status(400).json({ success: false, message: "paymentRef is required" });
    }

    const query = {
      academy: academy._id,
      occurrenceDate: { $gte: parsed.start, $lt: parsed.end },
      status: { $in: PAYABLE_STATUSES },
    };
    if (req.body?.coachId) query.coach = req.body.coachId;

    const docs = await CoachPayoutLedger.find(query).select("_id coach coachShare status");
    if (!docs.length) {
      return res.status(404).json({ success: false, message: "No payable payout rows found for this month" });
    }

    const ids = docs.map((d) => d._id);
    const coachSet = new Set(docs.map((d) => String(d.coach)));
    const totalCoachShare = docs.reduce((sum, d) => sum + Number(d.coachShare || 0), 0);

    await CoachPayoutLedger.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          paidBy: req.user._id,
          paymentRef,
          ...(req.body?.notes !== undefined ? { notes: String(req.body.notes || "") } : {}),
        },
      }
    );

    return res.json({
      success: true,
      message: "Monthly payouts marked as paid",
      data: {
        month: parsed.normalized,
        paidRows: ids.length,
        coachCount: coachSet.size,
        totalCoachShare: Number(totalCoachShare.toFixed(2)),
        paymentRef,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error paying monthly payout sheet" });
  }
};
