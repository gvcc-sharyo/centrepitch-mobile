import CoachStudentRelation from "../models/CoachStudentRelation.js";
import Coach from "../models/Coach.js";
import Player from "../models/Player.js";
import SportsAcademy from "../models/SportsAcademy.js";
import Court from "../models/Court.js";
import User from "../models/User.js";
import CoachStudentRelationHistory from "../models/CoachStudentRelationHistory.js";
import { assertWithinPlanLimit } from "../middleware/subscription.js";

const findCoachForUser = async (userId) => Coach.findOne({ userId });

const getCoachUserForLimitCheck = async (coachId) => {
  const coach = await Coach.findById(coachId).select("_id userId");
  if (!coach) return { coach: null, user: null };
  if (!coach.userId) return { coach, user: null };
  const user = await User.findById(coach.userId)
    .select("_id role activeRole roleRef subscriptionPlan subscriptionBillingCycle paymentStatus subscriptionExpiry")
    .lean();
  return { coach, user };
};

const enforceCoachMaxPlayersLimit = async ({ coachUser, coachId }) => {
  const activePlayerIds = await CoachStudentRelation.distinct("player", {
    coach: coachId,
    status: "active",
  });

  // Coach capacity must be enforced against coach subscription context,
  // even if the linked user's persisted role is still "player".
  const coachSubscriptionContext = coachUser
    ? { ...coachUser, role: "coach", activeRole: "coach" }
    : coachUser;
  if (coachSubscriptionContext && Object.prototype.hasOwnProperty.call(coachSubscriptionContext, "roleRef")) {
    // Force role resolution from coach context instead of stale base-role roleRef.
    delete coachSubscriptionContext.roleRef;
  }

  return assertWithinPlanLimit({
    user: coachSubscriptionContext,
    limitKey: "maxPlayers",
    increment: 1,
    currentUsage: activePlayerIds.length,
  });
};

const writeRelationHistory = async ({
  relation,
  coach,
  player,
  sport = null,
  previousStatus = "",
  newStatus = "",
  action,
  actorUser = null,
  actorRole = "",
  source = "",
  reason = "",
  metadata = {},
}) => {
  try {
    await CoachStudentRelationHistory.create({
      relation,
      coach,
      player,
      sport,
      previousStatus,
      newStatus,
      action,
      actorUser,
      actorRole: String(actorRole || ""),
      source,
      reason: reason || "",
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("Coach-student history write failed:", error.message);
  }
};

// ============================================================
// PLAYER requests training from a coach
// ============================================================

/**
 * @desc    Player sends a training request to a coach
 * @route   POST /api/coach-students/request
 * @access  Private (Player)
 */
export const requestTraining = async (req, res) => {
  try {
    const { coachId, sportId, sportName, message } = req.body;

    if (!coachId || !sportId) {
      return res.status(400).json({ success: false, message: "Coach and sport are required" });
    }

    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const coach = await Coach.findById(coachId);
    if (!coach || coach.status !== "APPROVED") {
      return res.status(404).json({ success: false, message: "Coach not found or not approved" });
    }

    const existing = await CoachStudentRelation.findOne({
      coach: coachId,
      player: player._id,
      sport: sportId,
    });

    if (existing) {
      if (existing.status === "active") {
        return res.status(400).json({ success: false, message: "You are already training with this coach for this sport" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ success: false, message: "You already have a pending request" });
      }
      existing.status = "pending";
      existing.message = message || "";
      existing.source = "player_request";
      existing.rejectionReason = "";
      await existing.save();
      return res.json({ success: true, message: "Training request re-submitted", data: existing });
    }

    const relation = await CoachStudentRelation.create({
      coach: coachId,
      player: player._id,
      sport: sportId,
      sportName: sportName || "",
      source: "player_request",
      message: message || "",
      status: "pending",
    });

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus: "",
      newStatus: relation.status,
      action: "REQUEST_SUBMITTED",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "player",
      source: "player_request",
      metadata: { endpoint: "requestTraining" },
    });

    res.status(201).json({ success: true, message: "Training request sent", data: relation });
  } catch (error) {
    console.error("Request training error:", error);
    res.status(500).json({ success: false, message: "Error sending request", error: error.message });
  }
};

/**
 * @desc    Get the player's own coach relations
 * @route   GET /api/coach-students/player/my
 * @access  Private (Player)
 */
export const getMyCoachRelations = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const relations = await CoachStudentRelation.find({ player: player._id })
      .populate("coach", "firstName lastName email profilePhoto specialization pricing availability")
      .populate("sport", "name slug")
      .populate("academy", "name logo")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: relations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching relations" });
  }
};

// ============================================================
// COACH manages students
// ============================================================

/**
 * @desc    Get all students (relations) for the logged-in coach
 * @route   GET /api/coach-students/my
 * @access  Private (Coach)
 */
export const getMyStudents = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { status, sport } = req.query;
    const query = { coach: coach._id };
    if (status) query.status = status;
    if (sport) query.sport = sport;

    const relations = await CoachStudentRelation.find(query)
      .populate("player", "name email phone photo gender dateOfBirth sports position")
      .populate("sport", "name slug")
      .populate("academy", "name logo")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: relations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
};

/**
 * @desc    Coach approves a student request
 * @route   PUT /api/coach-students/:id/approve
 * @access  Private (Coach)
 */
export const approveStudent = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, coach: coach._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    if (relation.status !== "pending") {
      return res.status(400).json({ success: false, message: `Request is already ${relation.status}` });
    }

    const { user: coachUser } = await getCoachUserForLimitCheck(coach._id);
    if (!coachUser) {
      return res.status(400).json({
        success: false,
        message: "Coach user account is not mapped for subscription checks",
      });
    }

    const limitCheck = await enforceCoachMaxPlayersLimit({
      coachUser,
      coachId: coach._id,
    });
    if (!limitCheck.allowed) {
      return res.status(limitCheck.status).json(limitCheck.payload);
    }

    const previousStatus = relation.status;
    relation.status = "active";
    relation.startedAt = new Date();
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "APPROVED_BY_COACH",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "coach",
      source: relation.source || "player_request",
      metadata: { endpoint: "approveStudent" },
    });

    coach.totalStudentsTaught = (coach.totalStudentsTaught || 0) + 1;
    await coach.save();

    res.json({ success: true, message: "Student approved", data: relation });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error approving student" });
  }
};

/**
 * @desc    Coach rejects a student request
 * @route   PUT /api/coach-students/:id/reject
 * @access  Private (Coach)
 */
export const rejectStudent = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, coach: coach._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const previousStatus = relation.status;
    relation.status = "rejected";
    relation.rejectionReason = req.body.reason || "";
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "REJECTED_BY_COACH",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "coach",
      source: relation.source || "coach_invite",
      reason: relation.rejectionReason || "",
      metadata: { endpoint: "rejectStudent" },
    });

    res.json({ success: true, message: "Student rejected", data: relation });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error rejecting student" });
  }
};

/**
 * @desc    Coach invites a player to train
 * @route   POST /api/coach-students/invite
 * @access  Private (Coach)
 */
export const invitePlayer = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { playerId, sportId, sportName, message } = req.body;
    if (!playerId || !sportId) {
      return res.status(400).json({ success: false, message: "Player and sport are required" });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: "Player not found" });
    }

    const existing = await CoachStudentRelation.findOne({
      coach: coach._id,
      player: playerId,
      sport: sportId,
    });

    if (existing && existing.status === "active") {
      return res.status(400).json({ success: false, message: "Player is already an active student" });
    }
    if (existing && existing.status === "pending" && existing.source === "player_request") {
      return res.status(400).json({ success: false, message: "Player already sent a pending request" });
    }

    if (existing) {
      const previousStatus = existing.status;
      existing.status = "pending";
      existing.source = "coach_invite";
      existing.startedAt = undefined;
      existing.message = message || "";
      existing.rejectionReason = "";
      existing.reviewedBy = undefined;
      existing.reviewedAt = undefined;
      await existing.save();

      await writeRelationHistory({
        relation: existing._id,
        coach: existing.coach,
        player: existing.player,
        sport: existing.sport,
        previousStatus,
        newStatus: existing.status,
        action: "INVITE_SENT",
        actorUser: req.user?._id || null,
        actorRole: req.user?.role || "coach",
        source: "coach_invite",
        metadata: { endpoint: "invitePlayer", reusedRelation: true },
      });
      return res.json({ success: true, message: "Invite sent to player. Waiting for acceptance.", data: existing });
    }

    const relation = await CoachStudentRelation.create({
      coach: coach._id,
      player: playerId,
      sport: sportId,
      sportName: sportName || "",
      source: "coach_invite",
      status: "pending",
      message: message || "",
    });

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus: "",
      newStatus: relation.status,
      action: "INVITE_SENT",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "coach",
      source: "coach_invite",
      metadata: { endpoint: "invitePlayer", reusedRelation: false },
    });

    res.status(201).json({ success: true, message: "Invite sent to player. Waiting for acceptance.", data: relation });
  } catch (error) {
    console.error("Invite player error:", error);
    res.status(500).json({ success: false, message: "Error inviting player", error: error.message });
  }
};

/**
 * @desc    Player accepts coach invite
 * @route   PUT /api/coach-students/:id/accept-invite
 * @access  Private (Player)
 */
export const acceptCoachInvite = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, player: player._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }
    if (relation.source !== "coach_invite") {
      return res.status(400).json({ success: false, message: "This relation is not a coach invite" });
    }
    if (relation.status !== "pending") {
      return res.status(400).json({ success: false, message: `Invite is already ${relation.status}` });
    }

    const { coach: coachRecord, user: coachUser } = await getCoachUserForLimitCheck(relation.coach);
    if (!coachRecord) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }
    if (!coachUser) {
      return res.status(400).json({ success: false, message: "Coach user account is not mapped for subscription checks" });
    }

    const limitCheck = await enforceCoachMaxPlayersLimit({
      coachUser,
      coachId: coachRecord._id,
    });
    if (!limitCheck.allowed) {
      return res.status(limitCheck.status).json(limitCheck.payload);
    }

    const previousStatus = relation.status;
    relation.status = "active";
    relation.startedAt = new Date();
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "INVITE_ACCEPTED_BY_PLAYER",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "player",
      source: relation.source || "coach_invite",
      metadata: { endpoint: "acceptCoachInvite" },
    });

    const coachDoc = await Coach.findById(relation.coach);
    if (coachDoc) {
      coachDoc.totalStudentsTaught = (coachDoc.totalStudentsTaught || 0) + 1;
      await coachDoc.save();
    }

    return res.json({ success: true, message: "Coach invite accepted", data: relation });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error accepting coach invite", error: error.message });
  }
};

/**
 * @desc    Player rejects coach invite
 * @route   PUT /api/coach-students/:id/reject-invite
 * @access  Private (Player)
 */
export const rejectCoachInvite = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, player: player._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }
    if (relation.source !== "coach_invite") {
      return res.status(400).json({ success: false, message: "This relation is not a coach invite" });
    }
    if (relation.status !== "pending") {
      return res.status(400).json({ success: false, message: `Invite is already ${relation.status}` });
    }

    const previousStatus = relation.status;
    relation.status = "rejected";
    relation.rejectionReason = req.body?.reason || "Rejected by player";
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "INVITE_REJECTED_BY_PLAYER",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "player",
      source: relation.source || "coach_invite",
      reason: relation.rejectionReason || "",
      metadata: { endpoint: "rejectCoachInvite" },
    });

    return res.json({ success: true, message: "Coach invite rejected", data: relation });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error rejecting coach invite", error: error.message });
  }
};

/**
 * @desc    Remove a student
 * @route   PUT /api/coach-students/:id/remove
 * @access  Private (Coach)
 */
export const removeStudent = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, coach: coach._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const previousStatus = relation.status;
    relation.status = "inactive";
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "REMOVED_BY_COACH",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "coach",
      source: relation.source || "system",
      metadata: { endpoint: "removeStudent" },
    });

    res.json({ success: true, message: "Student removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error removing student" });
  }
};

/**
 * @desc    Player leaves a coach (self-removal)
 * @route   PUT /api/coach-students/:id/leave
 * @access  Private (Player)
 */
export const leaveCoach = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const relation = await CoachStudentRelation.findOne({ _id: req.params.id, player: player._id });
    if (!relation) {
      return res.status(404).json({ success: false, message: "Coaching relation not found" });
    }

    if (relation.status === "inactive") {
      return res.status(400).json({ success: false, message: "You have already left this coach" });
    }

    const previousStatus = relation.status;
    relation.status = "inactive";
    relation.reviewedBy = req.user._id;
    relation.reviewedAt = new Date();
    await relation.save();

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus,
      newStatus: relation.status,
      action: "LEFT_BY_PLAYER",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "player",
      source: relation.source || "system",
      metadata: { endpoint: "leaveCoach" },
    });

    res.json({ success: true, message: "You have left this coach" });
  } catch (error) {
    console.error("Leave coach error:", error);
    res.status(500).json({ success: false, message: "Error leaving coach" });
  }
};

// ============================================================
// ACADEMY ADMIN assigns coach to player
// ============================================================

/**
 * @desc    Academy admin assigns a coach-student relation
 * @route   POST /api/coach-students/academy/assign
 * @access  Private (Academy Admin)
 */
export const academyAssign = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const { coachId, playerId, sportId, sportName } = req.body;
    if (!coachId || !playerId || !sportId) {
      return res.status(400).json({ success: false, message: "Coach, player, and sport are required" });
    }

    const existing = await CoachStudentRelation.findOne({
      coach: coachId,
      player: playerId,
      sport: sportId,
    });

    if (existing && existing.status === "active") {
      return res.status(400).json({ success: false, message: "This relation already exists" });
    }

    const { coach: coachRecord, user: coachUser } = await getCoachUserForLimitCheck(coachId);
    if (!coachRecord) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }
    if (!coachUser) {
      return res.status(400).json({ success: false, message: "Coach user account is not mapped for subscription checks" });
    }

    const limitCheck = await enforceCoachMaxPlayersLimit({
      coachUser,
      coachId: coachRecord._id,
    });
    if (!limitCheck.allowed) {
      return res.status(limitCheck.status).json(limitCheck.payload);
    }

    if (existing) {
      const previousStatus = existing.status;
      existing.status = "active";
      existing.academy = academy._id;
      existing.source = "academy_assigned";
      existing.startedAt = new Date();
      existing.rejectionReason = "";
      await existing.save();

      await writeRelationHistory({
        relation: existing._id,
        coach: existing.coach,
        player: existing.player,
        sport: existing.sport,
        previousStatus,
        newStatus: existing.status,
        action: "ASSIGNED_BY_ACADEMY",
        actorUser: req.user?._id || null,
        actorRole: req.user?.role || "academyadmin",
        source: "academy_assigned",
        metadata: {
          endpoint: "academyAssign",
          academyId: academy._id,
          reusedRelation: true,
        },
      });
      return res.json({ success: true, message: "Coach-player relation activated", data: existing });
    }

    const relation = await CoachStudentRelation.create({
      coach: coachId,
      player: playerId,
      sport: sportId,
      sportName: sportName || "",
      academy: academy._id,
      source: "academy_assigned",
      status: "active",
      startedAt: new Date(),
    });

    await writeRelationHistory({
      relation: relation._id,
      coach: relation.coach,
      player: relation.player,
      sport: relation.sport,
      previousStatus: "",
      newStatus: relation.status,
      action: "ASSIGNED_BY_ACADEMY",
      actorUser: req.user?._id || null,
      actorRole: req.user?.role || "academyadmin",
      source: "academy_assigned",
      metadata: {
        endpoint: "academyAssign",
        academyId: academy._id,
        reusedRelation: false,
      },
    });

    coachRecord.totalStudentsTaught = (coachRecord.totalStudentsTaught || 0) + 1;
    await coachRecord.save();

    res.status(201).json({ success: true, message: "Coach assigned to player", data: relation });
  } catch (error) {
    console.error("Academy assign error:", error);
    res.status(500).json({ success: false, message: "Error assigning coach", error: error.message });
  }
};

/**
 * @desc    Get all coach-student relations for the academy
 * @route   GET /api/coach-students/academy
 * @access  Private (Academy Admin)
 */
export const getAcademyRelations = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: "Academy not found" });
    }

    const relations = await CoachStudentRelation.find({ academy: academy._id })
      .populate("coach", "firstName lastName email profilePhoto")
      .populate("player", "name email phone photo")
      .populate("sport", "name slug")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: relations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching relations" });
  }
};

// ============================================================
// COACH helper endpoints
// ============================================================

/**
 * @desc    Search players for invite (excludes already-added students for selected sport)
 * @route   GET /api/coach-students/search-players
 * @access  Private (Coach)
 */
export const searchPlayersForInvite = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const { search = "", sport } = req.query;

    const existingRelations = await CoachStudentRelation.find({
      coach: coach._id,
      status: { $in: ["active", "pending"] },
      ...(sport ? { sport } : {}),
    }).select("player");

    const excludeIds = existingRelations.map((r) => r.player);

    const query = {
      _id: { $nin: excludeIds },
      isActive: true,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const players = await Player.find(query)
      .select("name email phone photo gender sports position")
      .limit(50)
      .sort({ name: 1 });

    res.json({ success: true, data: players });
  } catch (error) {
    console.error("Search players error:", error);
    res.status(500).json({ success: false, message: "Error searching players" });
  }
};

/**
 * @desc    Get courts from coach's associated academies
 * @route   GET /api/coach-students/my-courts
 * @access  Private (Coach)
 */
export const getCoachCourts = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const approvedAcademyIds = (coach.academies || [])
      .filter((a) => a.status === "APPROVED" || a.status === "ACTIVE")
      .map((a) => a.academy);

    if (approvedAcademyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const courts = await Court.find({
      academy: { $in: approvedAcademyIds },
      status: "APPROVED",
    })
      .select("name sportType sportTypes courtType location facilities images pricePerHour academy")
      .populate("sportType", "name")
      .populate("sportTypes", "name")
      .populate("academy", "name")
      .sort({ name: 1 });

    res.json({ success: true, data: courts });
  } catch (error) {
    console.error("Get coach courts error:", error);
    res.status(500).json({ success: false, message: "Error fetching courts" });
  }
};
