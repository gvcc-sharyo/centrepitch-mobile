import JoinRequest from "../models/JoinRequest.js";
import Coach from "../models/Coach.js";
import SportsAcademy from "../models/SportsAcademy.js";

/**
 * @desc    Coach submits a request to join an academy
 * @route   POST /api/join-requests
 * @access  Private (Coach)
 */
export const createJoinRequest = async (req, res) => {
  try {
    const { academyId, message } = req.body;

    if (!academyId) {
      return res.status(400).json({ success: false, message: "Academy ID is required" });
    }

    const coach = await Coach.findOne({ userId: req.user._id });
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const currentAcademies = coach.academies || [];

    const existing = currentAcademies.find(a => a.academy.toString() === academyId);
    if (existing && (existing.status === "APPROVED" || existing.status === "PENDING")) {
      return res.status(400).json({
        success: false,
        message: existing.status === "APPROVED"
          ? "You are already associated with this academy"
          : "You already have a pending request for this academy",
      });
    }

    const academy = await SportsAcademy.findById(academyId);
    if (!academy || academy.status !== "APPROVED") {
      return res.status(404).json({ success: false, message: "Academy not found or not approved" });
    }

    // Add PENDING entry to coach's academies (or update a previously REJECTED one)
    if (existing) {
      existing.status = "PENDING";
      existing.joinedAt = new Date();
      existing.removedAt = undefined;
    } else {
      coach.academies.push({ academy: academyId, status: "PENDING" });
    }
    await coach.save();

    // Also create a JoinRequest record for audit trail
    const joinRequest = await JoinRequest.create({
      coach: coach._id,
      academy: academyId,
      message: message || "",
    });

    res.status(201).json({
      success: true,
      message: "Join request submitted successfully",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Create join request error:", error);
    res.status(500).json({ success: false, message: "Error creating join request", error: error.message });
  }
};

/**
 * @desc    Get join requests for the coach's own requests
 * @route   GET /api/join-requests/my
 * @access  Private (Coach)
 */
export const getMyJoinRequests = async (req, res) => {
  try {
    const coach = await Coach.findOne({ userId: req.user._id });
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const requests = await JoinRequest.find({ coach: coach._id })
      .populate("academy", "name logo address sportsOffered")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching join requests" });
  }
};

/**
 * @desc    Get join requests for an academy (kept for backwards compatibility / audit)
 * @route   GET /api/join-requests/academy
 * @access  Private (Academy Admin)
 */
export const getAcademyJoinRequests = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const { status } = req.query;
    const filter = { academy: academy._id };
    if (status) filter.status = status;

    const requests = await JoinRequest.find(filter)
      .populate("coach", "firstName lastName email phone specialization profilePhoto coachType totalExperience averageRating")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching join requests" });
  }
};

/**
 * @desc    Approve a join request (academy admin)
 * @route   PUT /api/join-requests/:id/approve
 * @access  Private (Academy Admin)
 */
export const approveJoinRequest = async (req, res) => {
  try {
    const joinRequest = await JoinRequest.findById(req.params.id);
    if (!joinRequest) {
      return res.status(404).json({ success: false, message: "Join request not found" });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || academy._id.toString() !== joinRequest.academy.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to approve this request" });
    }

    if (joinRequest.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Request is already ${joinRequest.status.toLowerCase()}` });
    }

    const coach = await Coach.findById(joinRequest.coach);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    // Update the membership entry
    const entry = coach.academies.find(a => a.academy.toString() === academy._id.toString());
    if (entry) {
      entry.status = "APPROVED";
      entry.joinedAt = new Date();
      entry.removedAt = undefined;
    } else {
      coach.academies.push({ academy: academy._id, status: "APPROVED" });
    }

    if (coach.coachType === "FREELANCER") {
      coach.coachType = "BOTH";
    }
    await coach.save();

    joinRequest.status = "APPROVED";
    joinRequest.reviewedBy = req.user._id;
    joinRequest.reviewedAt = new Date();
    await joinRequest.save();

    res.json({
      success: true,
      message: "Join request approved. Coach has been added to your academy.",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Approve join request error:", error);
    res.status(500).json({ success: false, message: "Error approving join request" });
  }
};

/**
 * @desc    Reject a join request (academy admin)
 * @route   PUT /api/join-requests/:id/reject
 * @access  Private (Academy Admin)
 */
export const rejectJoinRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    const joinRequest = await JoinRequest.findById(req.params.id);
    if (!joinRequest) {
      return res.status(404).json({ success: false, message: "Join request not found" });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || academy._id.toString() !== joinRequest.academy.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to reject this request" });
    }

    if (joinRequest.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Request is already ${joinRequest.status.toLowerCase()}` });
    }

    // Update the membership entry
    const coach = await Coach.findById(joinRequest.coach);
    if (coach) {
      const entry = coach.academies.find(a => a.academy.toString() === academy._id.toString());
      if (entry) {
        entry.status = "REJECTED";
        entry.removedAt = new Date();
      }
      await coach.save();
    }

    joinRequest.status = "REJECTED";
    joinRequest.rejectionReason = reason || "";
    joinRequest.reviewedBy = req.user._id;
    joinRequest.reviewedAt = new Date();
    await joinRequest.save();

    res.json({
      success: true,
      message: "Join request rejected",
      data: joinRequest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error rejecting join request" });
  }
};
