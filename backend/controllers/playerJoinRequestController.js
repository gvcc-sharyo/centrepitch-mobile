import PlayerJoinRequest from "../models/PlayerJoinRequest.js";
import Player from "../models/Player.js";
import SportsAcademy from "../models/SportsAcademy.js";
import Team from "../models/Team.js";

const MAX_ACADEMIES = 5;

/**
 * @desc    Player submits a request to join an academy
 * @route   POST /api/player-join-requests
 * @access  Private (Player)
 */
export const createPlayerJoinRequest = async (req, res) => {
  try {
    const { academyId, message } = req.body;

    if (!academyId) {
      return res.status(400).json({ success: false, message: "Academy ID is required" });
    }

    let player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found. Please update your profile first." });
    }

    if (!player.sports || player.sports.length === 0) {
      return res.status(400).json({ success: false, message: "Please add at least one sport to your profile before joining an academy." });
    }

    const academy = await SportsAcademy.findById(academyId);
    if (!academy || academy.status !== "APPROVED") {
      return res.status(404).json({ success: false, message: "Academy not found or not approved" });
    }

    if (player.academies && player.academies.length >= MAX_ACADEMIES) {
      return res.status(400).json({
        success: false,
        message: `You can join a maximum of ${MAX_ACADEMIES} academies.`,
      });
    }

    if (player.academies && player.academies.some(a => a.toString() === academyId)) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this academy",
      });
    }

    const existingRequest = await PlayerJoinRequest.findOne({
      player: player._id,
      academy: academyId,
      status: "PENDING",
    });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending request for this academy",
      });
    }

    const joinRequest = await PlayerJoinRequest.create({
      player: player._id,
      user: req.user._id,
      academy: academyId,
      message: message || "",
      sports: player.sports.map(s => ({
        sport: s.sport,
        sportName: s.sportName,
        position: s.position,
        level: s.level,
      })),
    });

    res.status(201).json({
      success: true,
      message: "Join request submitted successfully",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Create player join request error:", error);
    res.status(500).json({ success: false, message: "Error creating join request", error: error.message });
  }
};

/**
 * @desc    Get the player's own join requests
 * @route   GET /api/player-join-requests/my
 * @access  Private (Player)
 */
export const getMyPlayerJoinRequests = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const requests = await PlayerJoinRequest.find({ player: player._id })
      .populate("academy", "name logo address sportsOffered")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching join requests" });
  }
};

/**
 * @desc    Get join requests for an academy (academy admin view)
 * @route   GET /api/player-join-requests/academy
 * @access  Private (Academy Admin)
 */
export const getAcademyPlayerJoinRequests = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const { status } = req.query;
    const filter = { academy: academy._id };
    if (status) filter.status = status;

    const requests = await PlayerJoinRequest.find(filter)
      .populate("player", "name email phone gender dateOfBirth photo sports position jerseyNumber")
      .populate("user", "firstName lastName email profilePhoto")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching player join requests" });
  }
};

/**
 * @desc    Approve a player join request
 * @route   PUT /api/player-join-requests/:id/approve
 * @access  Private (Academy Admin)
 */
export const approvePlayerJoinRequest = async (req, res) => {
  try {
    const joinRequest = await PlayerJoinRequest.findById(req.params.id);
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

    const player = await Player.findById(joinRequest.player);
    if (!player) {
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    if (!player.academies.some(a => a.toString() === academy._id.toString())) {
      player.academies.push(academy._id);
    }
    player.isActive = true;
    await player.save();

    joinRequest.status = "APPROVED";
    joinRequest.reviewedBy = req.user._id;
    joinRequest.reviewedAt = new Date();
    await joinRequest.save();

    res.json({
      success: true,
      message: "Player join request approved. Player has been added to your academy.",
      data: joinRequest,
    });
  } catch (error) {
    console.error("Approve player join request error:", error);
    res.status(500).json({ success: false, message: "Error approving join request" });
  }
};

/**
 * @desc    Reject a player join request
 * @route   PUT /api/player-join-requests/:id/reject
 * @access  Private (Academy Admin)
 */
export const rejectPlayerJoinRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    const joinRequest = await PlayerJoinRequest.findById(req.params.id);
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

    joinRequest.status = "REJECTED";
    joinRequest.rejectionReason = reason || "";
    joinRequest.reviewedBy = req.user._id;
    joinRequest.reviewedAt = new Date();
    await joinRequest.save();

    res.json({
      success: true,
      message: "Player join request rejected",
      data: joinRequest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error rejecting join request" });
  }
};

/**
 * @desc    Remove a player from academy
 * @route   PUT /api/player-join-requests/:id/remove
 * @access  Private (Academy Admin)
 */
export const removePlayerFromAcademy = async (req, res) => {
  try {
    const { playerId } = req.body;

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    player.academies = player.academies.filter(a => a.toString() !== academy._id.toString());

    const academyTeams = await Team.find({ academy: academy._id, _id: { $in: player.teams } });
    for (const team of academyTeams) {
      team.members = team.members.filter(m => m.poolPlayerId?.toString() !== player._id.toString());
      if (team.captain?.toString() === player._id.toString()) team.captain = null;
      await team.save();
      player.teams = player.teams.filter(t => t.toString() !== team._id.toString());
    }

    await player.save();

    await PlayerJoinRequest.updateMany(
      { player: player._id, academy: academy._id, status: "APPROVED" },
      { status: "REJECTED", rejectionReason: "Removed from academy", reviewedBy: req.user._id, reviewedAt: new Date() }
    );

    res.json({
      success: true,
      message: "Player removed from academy",
    });
  } catch (error) {
    console.error("Remove player from academy error:", error);
    res.status(500).json({ success: false, message: "Error removing player" });
  }
};

/**
 * @desc    Player leaves an academy voluntarily
 * @route   PUT /api/player-join-requests/leave
 * @access  Private (Player)
 */
export const leaveAcademy = async (req, res) => {
  try {
    const { academyId } = req.body;
    if (!academyId) {
      return res.status(400).json({ success: false, message: "Academy ID is required" });
    }

    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    if (!player.academies.some(a => a.toString() === academyId)) {
      return res.status(400).json({ success: false, message: "You are not a member of this academy" });
    }

    player.academies = player.academies.filter(a => a.toString() !== academyId);

    const academyTeams = await Team.find({ academy: academyId, _id: { $in: player.teams } });
    for (const team of academyTeams) {
      team.members = team.members.filter(m => {
        const pid = m.poolPlayerId?.toString();
        return pid !== player._id.toString();
      });
      if (team.captain?.toString() === player._id.toString()) {
        team.captain = null;
      }
      await team.save();
      player.teams = player.teams.filter(t => t.toString() !== team._id.toString());
    }

    await player.save();

    await PlayerJoinRequest.updateMany(
      { player: player._id, academy: academyId, status: "APPROVED" },
      { status: "REJECTED", rejectionReason: "Player left academy voluntarily", reviewedAt: new Date() }
    );

    res.json({ success: true, message: "You have left the academy successfully" });
  } catch (error) {
    console.error("Leave academy error:", error);
    res.status(500).json({ success: false, message: "Error leaving academy" });
  }
};
