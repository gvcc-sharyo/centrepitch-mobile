import CoachTeam from "../models/CoachTeam.js";
import Coach from "../models/Coach.js";
import CoachStudentRelation from "../models/CoachStudentRelation.js";
import Player from "../models/Player.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Team from "../models/Team.js";

const findCoachForUser = async (userId) => Coach.findOne({ userId });
const findPlayerForUser = async (userId) => Player.findOne({ user: userId });
const LEADERSHIP_ROLES = ["captain", "vice_captain"];
const normalizeRole = (role) => String(role || "player").toLowerCase();

const isCaptainMember = (team, playerId) =>
  (team.members || []).some(
    (m) =>
      m.player?.toString?.() === playerId.toString() &&
      m.status === "active" &&
      m.role === "captain"
  );

const isActiveMember = (team, playerId) =>
  (team.members || []).some(
    (m) =>
      m.player?.toString?.() === playerId.toString() &&
      m.status === "active"
  );

const hasLeadershipConflict = (team, role, excludeMemberId = null) => {
  const normalized = normalizeRole(role);
  if (!LEADERSHIP_ROLES.includes(normalized)) return false;

  return (team.members || []).some((m) => {
    if (excludeMemberId && m?._id?.toString?.() === excludeMemberId.toString()) return false;
    return normalizeRole(m.role) === normalized;
  });
};

export const createTeam = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const {
      name, description, sportId, sportName, teamType,
      ageCategory, gameFormat, genderCategory,
      maxPlayers, minPlayers, maxSubstitutes, playingSize,
      coachName, managerName, primaryColor, secondaryColor,
      trainingSchedule, entryFee, location,
      contactEmail, contactPhone, members, maxSize
    } = req.body;

    if (!name || !sportId) {
      return res.status(400).json({ success: false, message: "Team name and sport are required" });
    }

    const membersPayload = Array.isArray(members) ? members : [];
    const captainCount = membersPayload.filter((m) => normalizeRole(m?.role) === "captain").length;
    const viceCaptainCount = membersPayload.filter((m) => normalizeRole(m?.role) === "vice_captain").length;
    if (captainCount > 1) {
      return res.status(400).json({ success: false, message: "Only one captain is allowed per team." });
    }
    if (viceCaptainCount > 1) {
      return res.status(400).json({ success: false, message: "Only one vice-captain is allowed per team." });
    }

    const maxP = Number(maxPlayers) || Number(maxSize) || 20;
    if (maxP > 0 && membersPayload.length > maxP) {
      return res.status(400).json({
        success: false,
        message: `Cannot add more than ${maxP} players to this team`,
      });
    }

    for (const m of membersPayload) {
      const playerId = m?.player;
      if (!playerId) {
        return res.status(400).json({
          success: false,
          message: "Each team member must include a player id",
        });
      }
      const relation = await CoachStudentRelation.findOne({
        coach: coach._id,
        player: playerId,
        status: "active",
      });
      if (!relation) {
        return res.status(400).json({
          success: false,
          message: "All initial team members must be your active students",
        });
      }
    }

    const team = await CoachTeam.create({
      name,
      description: description || "",
      coach: coach._id,
      sport: sportId,
      sportName: sportName || "",
      teamType: teamType || "permanent",
      ageCategory: ageCategory || "open",
      gameFormat: gameFormat || "team",
      genderCategory: genderCategory || "male",
      maxPlayers: Number(maxPlayers) || 0,
      minPlayers: Number(minPlayers) || 0,
      maxSubstitutes: Number(maxSubstitutes) || 0,
      playingSize: Number(playingSize) || 0,
      coachName: coachName || "",
      managerName: managerName || "",
      primaryColor: primaryColor || "#1e40af",
      secondaryColor: secondaryColor || "#ffffff",
      trainingSchedule: trainingSchedule || "",
      entryFee: Number(entryFee) || 0,
      location: location || {},
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || "",
      members: membersPayload,
      maxSize: maxSize || 20,
    });

    res.status(201).json({ success: true, message: "Team created", data: team });
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ success: false, message: "Error creating team", error: error.message });
  }
};

export const getMyTeams = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const teams = await CoachTeam.find({ coach: coach._id })
      .populate("sport", "name slug")
      .populate("players.player", "name email phone photo")
      .populate("members.player", "name email phone photo gender sports position")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching teams" });
  }
};

export const getTeamById = async (req, res) => {
  try {
    let team = await CoachTeam.findById(req.params.id)
      .populate("sport", "name slug")
      .populate("players.player", "name email phone photo gender sports position")
      .populate("members.player", "name email phone photo gender sports position dateOfBirth");

    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (req.user.role === "coach") {
      const coach = await findCoachForUser(req.user._id);
      if (!coach || team.coach?.toString?.() !== coach._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to access this team" });
      }
    } else if (req.user.role === "player") {
      const player = await findPlayerForUser(req.user._id);
      if (!player || !isActiveMember(team, player._id)) {
        return res.status(403).json({ success: false, message: "Only team members can access this team" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Not authorized to access this team" });
    }

    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching team" });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const team = await CoachTeam.findOne({ _id: req.params.id, coach: coach._id });
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const fields = [
      "name", "description", "sportName", "teamType",
      "ageCategory", "gameFormat", "genderCategory",
      "coachName", "managerName", "primaryColor", "secondaryColor",
      "trainingSchedule", "contactEmail", "contactPhone", "status"
    ];
    fields.forEach(f => { if (req.body[f] !== undefined) team[f] = req.body[f]; });

    const numFields = ["maxPlayers", "minPlayers", "maxSubstitutes", "playingSize", "entryFee", "maxSize"];
    numFields.forEach(f => { if (req.body[f] !== undefined) team[f] = Number(req.body[f]) || 0; });

    if (req.body.location) team.location = req.body.location;
    if (req.body.sportId) team.sport = req.body.sportId;
    if (req.body.members) team.members = req.body.members;

    await team.save();

    const populated = await CoachTeam.findById(team._id)
      .populate("sport", "name slug")
      .populate("members.player", "name email phone photo gender sports position");

    res.json({ success: true, message: "Team updated", data: populated });
  } catch (error) {
    console.error("Update team error:", error);
    res.status(500).json({ success: false, message: "Error updating team" });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const team = await CoachTeam.findOneAndDelete({ _id: req.params.id, coach: coach._id });
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    res.json({ success: true, message: "Team deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting team" });
  }
};

export const addPlayerToTeam = async (req, res) => {
  try {
    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    let coach = null;
    if (req.user.role === "coach") {
      coach = await findCoachForUser(req.user._id);
      if (!coach || team.coach?.toString?.() !== coach._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
      }
    } else if (req.user.role === "player") {
      const player = await findPlayerForUser(req.user._id);
      if (!player || !isCaptainMember(team, player._id)) {
        return res.status(403).json({ success: false, message: "Only captain can add players to this team" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
    }

    const { playerId, role, name, email, phone, position, jerseyNumber, gender, inviteOnly } = req.body;
    const requestedRole = normalizeRole(role);
    if (!playerId) {
      return res.status(400).json({ success: false, message: "Player ID is required" });
    }

    if (coach) {
      const relation = await CoachStudentRelation.findOne({
        coach: coach._id,
        player: playerId,
        status: "active",
      });
      if (!relation) {
        return res.status(400).json({ success: false, message: "Player must be an active student of yours" });
      }
    }

    const alreadyInMembers = team.members.some((m) => m.player.toString() === playerId);
    const alreadyInPlayers = team.players.some((p) => p.player.toString() === playerId);
    if (alreadyInMembers || alreadyInPlayers) {
      return res.status(400).json({ success: false, message: "Player is already in this team" });
    }

    const maxP = team.maxPlayers || team.maxSize || 20;
    const currentSize = team.members.length + team.players.length;
    if (currentSize >= maxP) {
      return res.status(400).json({ success: false, message: "Team is full" });
    }

    if (hasLeadershipConflict(team, requestedRole)) {
      return res.status(400).json({
        success: false,
        message: `Only one ${requestedRole === "captain" ? "captain" : "vice-captain"} is allowed per team`,
      });
    }

    const memberStatus = inviteOnly ? "pending" : "active";

    team.members.push({
      player: playerId,
      role: requestedRole || "player",
      name: name || "",
      email: email || "",
      phone: phone || "",
      position: position || "",
      jerseyNumber: jerseyNumber != null ? Number(jerseyNumber) : null,
      gender: gender || "",
      status: memberStatus,
    });
    await team.save();

    const populated = await CoachTeam.findById(team._id)
      .populate("members.player", "name email phone photo gender sports position");

    res.json({
      success: true,
      message: inviteOnly ? "Team invitation sent" : "Player added to team",
      data: populated
    });
  } catch (error) {
    console.error("Add player to team error:", error);
    res.status(500).json({ success: false, message: "Error adding player" });
  }
};

export const removePlayerFromTeam = async (req, res) => {
  try {
    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (req.user.role === "coach") {
      const coach = await findCoachForUser(req.user._id);
      if (!coach || team.coach?.toString?.() !== coach._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
      }
    } else if (req.user.role === "player") {
      const player = await findPlayerForUser(req.user._id);
      if (!player || !isCaptainMember(team, player._id)) {
        return res.status(403).json({ success: false, message: "Only captain can remove players from this team" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
    }

    const { playerId } = req.body;
    team.members = team.members.filter((m) => m.player.toString() !== playerId);
    team.players = team.players.filter((p) => p.player.toString() !== playerId);
    await team.save();

    res.json({ success: true, message: "Player removed from team", data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error removing player" });
  }
};

export const updateTeamMember = async (req, res) => {
  try {
    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (req.user.role === "coach") {
      const coach = await findCoachForUser(req.user._id);
      if (!coach || team.coach?.toString?.() !== coach._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
      }
    } else if (req.user.role === "player") {
      const player = await findPlayerForUser(req.user._id);
      if (!player || !isCaptainMember(team, player._id)) {
        return res.status(403).json({ success: false, message: "Only captain can update team members" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
    }

    const { memberId, role, position, jerseyNumber, status } = req.body;
    const member = team.members.id(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    if (role !== undefined) {
      const requestedRole = normalizeRole(role);
      if (hasLeadershipConflict(team, requestedRole, memberId)) {
        return res.status(400).json({
          success: false,
          message: `Only one ${requestedRole === "captain" ? "captain" : "vice-captain"} is allowed per team`,
        });
      }
      member.role = requestedRole;
    }
    if (position !== undefined) member.position = position;
    if (jerseyNumber !== undefined) member.jerseyNumber = jerseyNumber != null ? Number(jerseyNumber) : null;
    if (status !== undefined) member.status = status;

    await team.save();

    const populated = await CoachTeam.findById(team._id)
      .populate("members.player", "name email phone photo gender sports position");

    res.json({ success: true, message: "Member updated", data: populated });
  } catch (error) {
    console.error("Update member error:", error);
    res.status(500).json({ success: false, message: "Error updating member" });
  }
};

export const getAvailablePlayers = async (req, res) => {
  try {
    const coach = await findCoachForUser(req.user._id);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    const team = await CoachTeam.findOne({ _id: req.params.id, coach: coach._id });
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const existingMemberIds = team.members.map((m) => m.player.toString());
    const existingPlayerIds = team.players.map((p) => p.player.toString());
    const allExisting = [...existingMemberIds, ...existingPlayerIds];

    const relations = await CoachStudentRelation.find({
      coach: coach._id,
      status: "active",
      player: { $nin: allExisting },
    })
      .populate({
        path: "player",
        select: "name email phone photo gender sports position dateOfBirth user",
        populate: { path: "sports.sport", select: "name slug" },
      });

    const players = relations.map((r) => r.player).filter(Boolean);

    res.json({ success: true, data: players });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching available players" });
  }
};

export const invitePlayerByEmail = async (req, res) => {
  try {
    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    if (req.user.role === "coach") {
      const coach = await findCoachForUser(req.user._id);
      if (!coach || team.coach?.toString?.() !== coach._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
      }
    } else if (req.user.role === "player") {
      const player = await findPlayerForUser(req.user._id);
      if (!player || !isCaptainMember(team, player._id)) {
        return res.status(403).json({ success: false, message: "Only captain can invite players" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Not authorized to manage this team" });
    }

    const { email, role = "player", position = "", jerseyNumber = null } = req.body;
    const requestedRole = normalizeRole(role);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.role !== "player") {
      return res.status(404).json({
        success: false,
        message: "No player account found with this email",
      });
    }

    let player = await Player.findOne({ user: user._id });
    if (!player) {
      player = await Player.create({
        user: user._id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Player",
        email: user.email || normalizedEmail,
        phone: user.phone || "",
      });
    }

    const alreadyInMembers = team.members.some((m) => m.player.toString() === player._id.toString());
    const alreadyInPlayers = team.players.some((p) => p.player.toString() === player._id.toString());
    if (alreadyInMembers || alreadyInPlayers) {
      return res.status(400).json({ success: false, message: "Player is already in this team" });
    }

    if (hasLeadershipConflict(team, requestedRole)) {
      return res.status(400).json({
        success: false,
        message: `Only one ${requestedRole === "captain" ? "captain" : "vice-captain"} is allowed per team`,
      });
    }

    const maxP = team.maxPlayers || team.maxSize || 20;
    const currentSize = team.members.length + team.players.length;
    if (currentSize >= maxP) {
      return res.status(400).json({ success: false, message: "Team is full" });
    }

    team.members.push({
      player: player._id,
      role: requestedRole,
      name: player.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: normalizedEmail,
      phone: player.phone || user.phone || "",
      position,
      jerseyNumber: jerseyNumber != null && jerseyNumber !== "" ? Number(jerseyNumber) : null,
      status: "pending",
    });
    await team.save();

    await Notification.create({
      recipient: user._id,
      sender: req.user._id,
      type: "team_invitation",
      title: "Team Join Request",
      message: `Coach sent a join request for team "${team.name}". Open Team Invites to accept or reject.`,
      data: { teamId: team._id },
    });

    return res.json({ success: true, message: "Invitation sent successfully" });
  } catch (error) {
    console.error("Invite player by email error:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending invitation",
      error: error.message,
    });
  }
};

export const getPlayerTeamInvites = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const teams = await CoachTeam.find({
      members: { $elemMatch: { player: player._id, status: "pending" } },
    })
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .sort({ updatedAt: -1 });

    const invites = teams.map((team) => {
      const member = (team.members || []).find(
        (m) =>
          m.player?.toString?.() === player._id.toString() &&
          m.status === "pending"
      );

      return {
        _id: team._id,
        teamName: team.name,
        sport: team.sport,
        sportName: team.sportName || team.sport?.name || "",
        coach: team.coach,
        invite: member
          ? {
              memberId: member._id,
              role: member.role,
              position: member.position,
              jerseyNumber: member.jerseyNumber,
              invitedAt: member.joinedAt || team.updatedAt,
            }
          : null,
      };
    });

    return res.json({ success: true, data: invites });
  } catch (error) {
    console.error("Get player team invites error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching team invites",
      error: error.message,
    });
  }
};

export const getMyCoachTeamsForPlayer = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.json({ success: true, data: [] });
    }

    const teams = await CoachTeam.find({
      members: { $elemMatch: { player: player._id, status: "active" } },
    })
      .populate("coach", "firstName lastName profilePhoto")
      .populate("sport", "name slug")
      .sort({ updatedAt: -1 });

    const data = teams.map((team) => {
      const me = (team.members || []).find(
        (m) =>
          m.player?.toString?.() === player._id.toString() &&
          m.status === "active"
      );
      return {
        _id: team._id,
        name: team.name,
        description: team.description || "",
        sport: team.sport,
        sportName: team.sportName || team.sport?.name || "",
        coach: team.coach,
        teamType: team.teamType,
        ageCategory: team.ageCategory,
        role: me?.role || "player",
        joinedAt: me?.joinedAt || team.updatedAt,
        membersCount: (team.members || []).filter((m) => m.status === "active").length,
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get my coach teams for player error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching coach teams",
      error: error.message,
    });
  }
};

export const respondToTeamInvite = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const { action } = req.body; // accept | reject
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be accept or reject" });
    }

    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const member = (team.members || []).find(
      (m) => m.player?.toString?.() === player._id.toString()
    );
    if (!member) {
      return res.status(404).json({ success: false, message: "Invitation not found" });
    }

    if (member.status !== "pending" && action === "accept") {
      return res.status(400).json({ success: false, message: "Invitation is not pending" });
    }

    if (action === "accept") {
      // Business rule: player can have only one active team per sport.
      const [activeCoachTeamSameSport, activeAcademyTeamSameSport] = await Promise.all([
        CoachTeam.findOne({
          _id: { $ne: team._id },
          sport: team.sport,
          members: { $elemMatch: { player: player._id, status: "active" } },
        }).select("name"),
        Team.findOne({
          isActive: true,
          sport: team.sport,
          members: { $elemMatch: { player: req.user._id, status: "active" } },
        }).select("name"),
      ]);

      if (activeCoachTeamSameSport || activeAcademyTeamSameSport) {
        return res.status(400).json({
          success: false,
          message: "You can only join one active team per sport. Leave your current team before accepting this invite.",
        });
      }

      member.status = "active";
      member.joinedAt = new Date();
    } else {
      team.members = team.members.filter(
        (m) => m.player?.toString?.() !== player._id.toString()
      );
    }

    await team.save();

    return res.json({
      success: true,
      message: action === "accept" ? "Invitation accepted" : "Invitation rejected",
    });
  } catch (error) {
    console.error("Respond to team invite error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating invitation",
      error: error.message,
    });
  }
};

export const leaveCoachTeamAsPlayer = async (req, res) => {
  try {
    const player = await Player.findOne({ user: req.user._id });
    if (!player) {
      return res.status(404).json({ success: false, message: "Player profile not found" });
    }

    const team = await CoachTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }

    const before = (team.members || []).length;
    team.members = (team.members || []).filter(
      (m) => m.player?.toString?.() !== player._id.toString()
    );

    if (before === team.members.length) {
      return res.status(404).json({ success: false, message: "You are not a member of this team" });
    }

    await team.save();

    return res.json({ success: true, message: "You left the team successfully" });
  } catch (error) {
    console.error("Leave coach team error:", error);
    return res.status(500).json({
      success: false,
      message: "Error leaving team",
      error: error.message,
    });
  }
};
