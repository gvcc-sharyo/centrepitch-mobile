import Team from '../models/Team.js';
import CoachTeam from '../models/CoachTeam.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Event from '../models/Event.js';
import EventTeamRegistration from '../models/EventTeamRegistration.js';
import EventAuditLog from '../models/EventAuditLog.js';
import Sport from '../models/Sport.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Player from '../models/Player.js';
import Coach from '../models/Coach.js';
import UserSport from '../models/UserSport.js';
import mongoose from 'mongoose';

const TEAM_OWNER_ASSIGNER_ROLES = ['organizer', 'academyadmin', 'coach'];
const LEADERSHIP_ROLES = ['captain', 'vice_captain'];

const auditEvent = async ({ entityType, entityId, action, actor, before = null, after = null, metadata = {}, session = null }) => {
  try {
    await EventAuditLog.create(
      [{ entityType, entityId, action, actor, before, after, metadata }],
      session ? { session } : undefined
    );
  } catch (err) {
    console.warn('Event audit log write failed:', err?.message || err);
  }
};

const normalizeRole = (role) => String(role || 'player').toLowerCase();

/**
 * One user may register a coach team and (separately) an organizer or academy team for the same event —
 * only block duplicates within the same scope.
 * `roleHint` is used when `ownerKind` is missing (legacy teams) for the team currently being registered.
 */
const eventRegistrationScopeKey = (t, roleHint = null) => {
  const ac = t?.academy;
  if (ac != null && String(ac).trim() !== '') return `academy:${String(ac)}`;
  const ok = String(t?.ownerKind || '').toLowerCase();
  if (ok === 'organizer') return 'organizer';
  if (ok === 'coach') return 'coach';
  const r = String(roleHint || '').toLowerCase();
  if (r === 'organizer') return 'organizer';
  if (r === 'coach') return 'coach';
  return 'coach';
};

const normalizeSportText = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getLeadershipCounts = (members = []) => {
  return (members || []).reduce(
    (acc, member) => {
      const role = normalizeRole(member?.role);
      if (role === 'captain') acc.captain += 1;
      if (role === 'vice_captain') acc.vice_captain += 1;
      return acc;
    },
    { captain: 0, vice_captain: 0 }
  );
};

const validateSingleLeadership = (members = []) => {
  const counts = getLeadershipCounts(members);
  if (counts.captain > 1) return 'Only one captain is allowed per team.';
  if (counts.vice_captain > 1) return 'Only one vice-captain is allowed per team.';
  return null;
};

const normalizeUserRole = (role = '') => String(role || '').trim().toLowerCase();

/** Captain, member row marked captain, or organizer/academy/coach who created the team */
const canManageStandardTeamRoster = (team, user) => {
  if (!team || !user?._id) return false;
  const userId = user._id.toString();
  if (team.captain?.toString?.() === userId) return true;
  const isCaptainMember = (team.members || []).some((m) => {
    if (!m?.player) return false;
    const pid = m.player._id ? m.player._id.toString() : m.player.toString();
    return normalizeRole(m?.role) === 'captain' && pid === userId;
  });
  if (isCaptainMember) return true;
  const creatorId = team.createdBy?.toString?.();
  return Boolean(
    creatorId === userId && TEAM_OWNER_ASSIGNER_ROLES.includes(normalizeUserRole(user.role))
  );
};

/** Writes EventTeamRegistration + legacy event.registeredTeams + audit (no transaction — works on standalone MongoDB). */
export const persistEventTeamRegistrationWrites = async ({
  event,
  team,
  payStatus,
  feeStatus,
  actorUserId,
  auditMetadata = {},
}) => {
  const before = await EventTeamRegistration.findOne({
    event: event._id,
    team: team._id,
  }).lean();

  const reg = await EventTeamRegistration.findOneAndUpdate(
    { event: event._id, team: team._id },
    {
      $set: {
        registrationDate: new Date(),
        paymentStatus: payStatus,
        status: feeStatus,
        registeredBy: actorUserId,
        withdrawnAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await auditEvent({
    entityType: 'event_team_registration',
    entityId: reg._id,
    action: before ? 're_registered' : 'created',
    actor: actorUserId,
    before,
    after: reg.toObject(),
    metadata: { eventId: event._id, teamId: team._id, ...auditMetadata },
  });

  const legacyRow = (event.registeredTeams || []).find(
    (rt) => rt.team && String(rt.team) === String(team._id)
  );
  if (legacyRow) {
    legacyRow.registrationDate = new Date();
    legacyRow.paymentStatus = payStatus;
    legacyRow.status = feeStatus;
  } else {
    event.registeredTeams.push({
      team: team._id,
      registrationDate: new Date(),
      paymentStatus: payStatus,
      status: feeStatus,
    });
  }
  await event.save();
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveCatalogSportIdFromCoachTeam = async (ct) => {
  let name = (ct.sportName || '').trim();
  if (!name && ct.sport) {
    const us = await UserSport.findById(ct.sport).select('name').lean();
    name = (us?.name || '').trim();
  }
  if (!name) return null;
  const sport = await Sport.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') })
    .select('_id')
    .lean();
  return sport?._id || null;
};

const resolveOrCreateTeamFromCoachTeam = async (coachTeamDoc, userId) => {
  if (coachTeamDoc.linkedStandardTeamId) {
    const existing = await Team.findById(coachTeamDoc.linkedStandardTeamId).populate('sport', 'name');
    if (existing) return existing;
  }
  const sportId = await resolveCatalogSportIdFromCoachTeam(coachTeamDoc);
  if (!sportId) {
    const err = new Error(
      'Could not match this coach team sport to a catalog sport. Ensure the sport name matches the event sport.',
    );
    err.statusCode = 400;
    throw err;
  }
  const members = [];
  let captainId = userId;
  const rawMembers = Array.isArray(coachTeamDoc.members) ? coachTeamDoc.members : [];
  for (const m of rawMembers) {
    if (!m?.player) continue;
    const player = await Player.findById(m.player).select('user').lean();
    const uid = player?.user;
    if (!uid) continue;
    const u = await User.findById(uid).select('firstName lastName email').lean();
    members.push({
      player: uid,
      role: m.role || 'player',
      name: m.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || '',
      email: m.email || u?.email || '',
      joinedAt: m.joinedAt || new Date(),
      status: m.status || 'active',
    });
    if (normalizeRole(m.role) === 'captain') captainId = uid;
  }
  const teamPayload = {
    name: coachTeamDoc.name,
    description: coachTeamDoc.description || '',
    sport: sportId,
    sportName: coachTeamDoc.sportName || '',
    teamType: coachTeamDoc.teamType || 'permanent',
    ageCategory: coachTeamDoc.ageCategory || 'open',
    gameFormat: coachTeamDoc.gameFormat || 'team',
    genderCategory: coachTeamDoc.genderCategory || 'male',
    maxPlayers: coachTeamDoc.maxPlayers || 0,
    minPlayers: coachTeamDoc.minPlayers || 0,
    maxSubstitutes: coachTeamDoc.maxSubstitutes || 0,
    playingSize: coachTeamDoc.playingSize || 0,
    captain: captainId,
    createdBy: userId,
    ownerKind: 'coach',
    academy: null,
    members,
    location: coachTeamDoc.location || {},
    contactEmail: coachTeamDoc.contactEmail || '',
    contactPhone: coachTeamDoc.contactPhone || '',
    primaryColor: coachTeamDoc.primaryColor || '',
    secondaryColor: coachTeamDoc.secondaryColor || '',
  };
  const team = await Team.create(teamPayload);
  coachTeamDoc.linkedStandardTeamId = team._id;
  await coachTeamDoc.save();
  await team.populate('sport', 'name');
  return team;
};

/**
 * Validates registration window, team access, sport match, duplicates, roster size.
 * Resolves coach CoachTeam id → standard Team when applicable.
 */
export const prepareTeamEventRegistrationContext = async ({
  actorUserId,
  actorRole,
  eventId,
  teamId,
}) => {
  const roleLower = normalizeRole(actorRole);

  const event = await Event.findById(eventId).populate('sport');
  if (!event) {
    return { ok: false, status: 404, message: 'Event not found' };
  }

  if (event.gameFormat !== 'team' && event.gameFormat !== 'doubles') {
    return { ok: false, status: 400, message: 'This event is not a team event' };
  }

  const now = new Date();
  const startRaw = event?.registrationStartDate ? new Date(event.registrationStartDate) : null;
  const endRaw = event?.registrationEndDate ? new Date(event.registrationEndDate) : null;
  if (!startRaw || Number.isNaN(startRaw.getTime()) || !endRaw || Number.isNaN(endRaw.getTime())) {
    return { ok: false, status: 400, message: 'Registration is not open for this event' };
  }
  const start = new Date(startRaw);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endRaw);
  end.setHours(23, 59, 59, 999);
  if (now < start || now > end) {
    return { ok: false, status: 400, message: 'Registration is not open for this event' };
  }

  let team = await Team.findById(teamId).populate('sport', 'name');
  if (!team && roleLower === 'coach') {
    const coach = await Coach.findOne({ userId: actorUserId });
    if (coach) {
      const ct = await CoachTeam.findOne({
        _id: teamId,
        coach: coach._id,
        status: 'active',
      });
      if (ct) {
        try {
          team = await resolveOrCreateTeamFromCoachTeam(ct, actorUserId);
        } catch (linkErr) {
          return {
            ok: false,
            status: linkErr?.statusCode || 400,
            message: linkErr?.message || 'Could not prepare coach team for registration',
          };
        }
      }
    }
  }
  if (!team) {
    return { ok: false, status: 404, message: 'Team not found' };
  }

  if (roleLower === 'player') {
    const owner = team.createdBy ? await User.findById(team.createdBy).select('role') : null;
    const ownerRole = String(owner?.role || '').toLowerCase();
    if (!TEAM_OWNER_ASSIGNER_ROLES.includes(ownerRole)) {
      return {
        ok: false,
        status: 403,
        message: 'Players can register only organizer/academy/coach assigned teams.',
      };
    }
  }

  const isCaptain = team.captain && team.captain.toString() === actorUserId.toString();
  const isCreator = team.createdBy && team.createdBy.toString() === actorUserId.toString();
  if (!isCaptain && !isCreator) {
    return {
      ok: false,
      status: 403,
      message: 'Only the team captain or creator can register this team for events',
    };
  }

  const teamSportName = (team.sport?.name || team.sportName || '').toString().toLowerCase();
  const eventSportName = (event.sport?.name || '').toString().toLowerCase();
  if (!teamSportName || !eventSportName || teamSportName !== eventSportName) {
    return { ok: false, status: 400, message: 'Team sport does not match event sport' };
  }

  const [existingTeamReg, activeTeamRegs] = await Promise.all([
    EventTeamRegistration.findOne({ event: event._id, team: team._id, status: { $ne: 'withdrawn' } })
      .select('_id status paymentStatus')
      .lean(),
    EventTeamRegistration.find({ event: event._id, status: { $ne: 'withdrawn' } })
      .select('team')
      .lean(),
  ]);
  const legacyAlreadyRegistered = (event.registeredTeams || []).some(
    (r) => r.team && String(r.team) === String(team._id) && r.status !== 'withdrawn'
  );
  if (existingTeamReg || legacyAlreadyRegistered) {
    return { ok: false, status: 400, message: 'This team is already registered for this event' };
  }

  const activeTeamIds =
    activeTeamRegs && activeTeamRegs.length > 0
      ? activeTeamRegs.map((r) => r.team?.toString?.() || String(r.team))
      : (event.registeredTeams || [])
          .filter((r) => r.status !== 'withdrawn' && r.team)
          .map((r) => r.team.toString());
  const otherTeams = await Team.find({ _id: { $in: activeTeamIds } })
    .select('captain createdBy academy ownerKind')
    .lean();
  const registeringScope = eventRegistrationScopeKey(team, roleLower);
  const hasOtherRegistration = otherTeams.some((t) => {
    if (t._id.toString() === String(team._id)) return false;
    const sameActor =
      t.captain?.toString() === actorUserId.toString() ||
      t.createdBy?.toString() === actorUserId.toString();
    if (!sameActor) return false;
    return eventRegistrationScopeKey(t, null) === registeringScope;
  });
  if (hasOtherRegistration) {
    return {
      ok: false,
      status: 400,
      message: 'You already have another team registered for this event',
    };
  }

  const { teamSize } = event.registrationSettings || {};
  const minMembers = teamSize?.min || 1;
  const maxMembers = teamSize?.max || 20;
  const memberCount = team.members?.length || 0;
  if (memberCount < minMembers) {
    return {
      ok: false,
      status: 400,
      message: `Team must have at least ${minMembers} members (current: ${memberCount})`,
    };
  }
  if (memberCount > maxMembers) {
    return {
      ok: false,
      status: 400,
      message: `Team cannot have more than ${maxMembers} members (current: ${memberCount})`,
    };
  }

  return { ok: true, team, event };
};

// @desc    Create a new team
// @route   POST /api/teams
// @access  Private
export const createTeam = async (req, res) => {
  try {
    if (req.user?.role === 'player') {
      return res.status(403).json({
        success: false,
        message: 'Players cannot create teams directly. Ask organizer/academy/coach to create and assign you as captain.'
      });
    }

    const {
      name,
      logo,
      description,
      sport,
      sportName,
      teamType,
      ageCategory,
      gameFormat,
      genderCategory,
      maxPlayers,
      minPlayers,
      maxSubstitutes,
      playingSize,
      coachName,
      managerName,
      primaryColor,
      secondaryColor,
      trainingSchedule,
      entryFee,
      location,
      contactEmail,
      contactPhone,
      socialLinks,
      members: membersInput
    } = req.body;

    // Check if team name exists
    const existingTeam = await Team.findOne({ name, sport });
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'A team with this name already exists for this sport'
      });
    }

    let members = [];
    let captainId = req.user._id;
    // Organizers manage squads separately (invite after create). Academy/coach flows still seed creator as captain when no members are sent.
    const staffCreatesEmptyRoster = normalizeUserRole(req.user.role) === 'organizer';

    if (Array.isArray(membersInput) && membersInput.length > 0) {
      const leadershipError = validateSingleLeadership(membersInput);
      if (leadershipError) {
        return res.status(400).json({ success: false, message: leadershipError });
      }

      // Store every selected player's user ID in members[].player so players can see teams they belong to
      for (const m of membersInput) {
        const playerId = m.player || m.playerId;
        if (!playerId) continue;
        const user = await User.findById(playerId);
        if (!user) continue;
        const memberObj = {
          player: user._id, // required: so getTeamsByUser can find this team for the logged-in player
          name: m.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          email: user.email || '',
          role: m.role || 'player',
          jerseyNumber: m.jerseyNumber,
          position: m.position,
          joinedAt: new Date(),
          status: 'active'
        };
        members.push(memberObj);
        if (memberObj.role === 'captain') captainId = user._id;
      }
      if (members.length > 0 && captainId.toString() === req.user._id.toString()) {
        captainId = members[0].player;
        members[0].role = 'captain';
      }
    }

    if (members.length === 0) {
      if (staffCreatesEmptyRoster) {
        members = [];
        captainId = null;
      } else {
        members = [{
          player: req.user._id,
          role: 'captain',
          name: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email,
          email: req.user.email,
          joinedAt: new Date(),
          status: 'active'
        }];
        captainId = req.user._id;
      }
    }

    const team = await Team.create({
      name,
      logo,
      description,
      sport,
      sportName: sportName || '',
      teamType: teamType || 'event_specific',
      ageCategory: ageCategory || 'open',
      gameFormat: gameFormat || 'team',
      genderCategory: genderCategory || 'male',
      maxPlayers: maxPlayers || 0,
      minPlayers: minPlayers || 0,
      maxSubstitutes: maxSubstitutes || 0,
      playingSize: playingSize || 0,
      coachName: coachName || '',
      managerName: managerName || '',
      primaryColor: primaryColor || '',
      secondaryColor: secondaryColor || '',
      trainingSchedule: trainingSchedule || '',
      entryFee: entryFee || 0,
      captain: captainId,
      createdBy: req.user._id,
      location,
      contactEmail,
      contactPhone,
      socialLinks,
      members
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public
export const getTeams = async (req, res) => {
  try {
    const { page = 1, limit = 10, sport, city, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = { isActive: true };

    if (sport) query.sport = sport;
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const teams = await Team.find(query)
      .populate('captain', 'firstName lastName profilePhoto')
      .populate('academy', 'name')   // Add this line
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));;

    const total = await Team.countDocuments(query);

    res.json({
      success: true,
      data: teams,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get team by ID
// @route   GET /api/teams/:id
// @access  Public
export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain', 'firstName lastName email phone profilePhoto')
      .populate('sport', 'name slug')
      .populate('members.player', 'firstName lastName email phone profilePhoto performanceStats')
      .populate('eventsParticipated.event', 'name eventType startDate');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update team
// @route   PUT /api/teams/:id
// @access  Private (Captain)
export const updateTeam = async (req, res) => {
  try {
    let team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const isCaptain = team.captain && team.captain.toString() === req.user._id.toString();
    const isCreator =
      team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!isCaptain && !isCreator && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can update the team'
      });
    }

    if (req.user.role === 'player') {
      return res.status(403).json({
        success: false,
        message: 'Player captains can only add/remove team members.'
      });
    }

    team = await Team.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete team
// @route   DELETE /api/teams/:id
// @access  Private (Captain/Admin)
export const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const isCaptain = team.captain && team.captain.toString() === req.user._id.toString();
    const isCreator =
      team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!isCaptain && !isCreator && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can delete the team'
      });
    }

    if (req.user.role === 'player') {
      return res.status(403).json({
        success: false,
        message: 'Player captains are not allowed to delete teams.'
      });
    }

    // Notify all members
    const notifications = team.members
      .filter(m => {
        if (!m.player) return false;
        const playerId = m.player._id ? m.player._id.toString() : m.player.toString();
        return playerId !== req.user._id.toString();
      })
      .map(m => ({
        recipient: m.player,
        sender: req.user._id,
        type: 'team_removed',
        title: 'Team Deleted',
        message: `The team "${team.name}" has been deleted.`,
        data: { teamId: team._id }
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    await Team.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add member to team
// @route   POST /api/teams/:id/members
// @access  Private (Captain)
export const addMember = async (req, res) => {
  try {
    const { playerId, role, jerseyNumber, position } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (!canManageStandardTeamRoster(team, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can add members'
      });
    }

    if (req.user.role === 'player') {
      const owner = team.createdBy ? await User.findById(team.createdBy).select('role') : null;
      const ownerRole = String(owner?.role || '').toLowerCase();
      if (!TEAM_OWNER_ASSIGNER_ROLES.includes(ownerRole)) {
        return res.status(403).json({
          success: false,
          message: 'You can manage members only for organizer/academy/coach assigned teams.'
        });
      }
    }

    // Check if player exists
    const player = await User.findById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Check if already a member
    const isMember = team.members.some(m => {
      if (!m.player) return false;
      const memberPlayerId = m.player._id ? m.player._id.toString() : m.player.toString();
      return memberPlayerId === playerId;
    });
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Player is already a team member'
      });
    }

    const requestedRole = normalizeRole(role);
    if (LEADERSHIP_ROLES.includes(requestedRole)) {
      const roleAlreadyAssigned = team.members.some((m) => {
        if (!m?.player) return false;
        const memberPlayerId = m.player._id ? m.player._id.toString() : m.player.toString();
        return normalizeRole(m.role) === requestedRole && memberPlayerId !== playerId;
      });
      if (roleAlreadyAssigned) {
        return res.status(400).json({
          success: false,
          message: `Only one ${requestedRole === 'captain' ? 'captain' : 'vice-captain'} is allowed per team`
        });
      }
    }

    team.members.push({
      player: playerId,
      role: requestedRole || 'player',
      jerseyNumber,
      position,
      joinedAt: new Date(),
      status: 'active'
    });

    await team.save();

    // Notify the player
    await Notification.create({
      recipient: playerId,
      sender: req.user._id,
      type: 'team_joined',
      title: 'Added to Team',
      message: `You have been added to team "${team.name}".`,
      data: { teamId: team._id }
    });

    res.json({
      success: true,
      message: 'Member added successfully',
      data: team
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove member from team
// @route   DELETE /api/teams/:id/members/:memberId
// @access  Private (Captain)
export const removeMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (!canManageStandardTeamRoster(team, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can remove members'
      });
    }

    if (req.user.role === 'player') {
      const owner = team.createdBy ? await User.findById(team.createdBy).select('role') : null;
      const ownerRole = String(owner?.role || '').toLowerCase();
      if (!TEAM_OWNER_ASSIGNER_ROLES.includes(ownerRole)) {
        return res.status(403).json({
          success: false,
          message: 'You can manage members only for organizer/academy/coach assigned teams.'
        });
      }
    }

    // Cannot remove designated captain user
    if (team.captain && req.params.memberId === team.captain.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the team captain'
      });
    }

    team.members = team.members.filter(
      m => {
        // Handle null player references
        if (!m.player) return true; // Keep members without player reference
        const playerId = m.player._id ? m.player._id.toString() : m.player.toString();
        return playerId !== req.params.memberId;
      }
    );

    await team.save();

    // Notify the removed member
    await Notification.create({
      recipient: req.params.memberId,
      sender: req.user._id,
      type: 'team_removed',
      title: 'Removed from Team',
      message: `You have been removed from team "${team.name}".`,
      data: { teamId: team._id }
    });

    res.json({
      success: true,
      message: 'Member removed successfully',
      data: team
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update member role
// @route   PUT /api/teams/:id/members/:memberId
// @access  Private (Captain)
export const updateMemberRole = async (req, res) => {
  try {
    const { role, jerseyNumber, position, status } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (!canManageStandardTeamRoster(team, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can update member roles'
      });
    }

    const memberIndex = team.members.findIndex(
      m => {
        // Handle both populated and unpopulated player references, and null cases
        if (!m.player) return false;
        const playerId = m.player._id ? m.player._id.toString() : m.player.toString();
        return playerId === req.params.memberId;
      }
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (role) {
      const requestedRole = normalizeRole(role);
      if (LEADERSHIP_ROLES.includes(requestedRole)) {
        const roleAlreadyAssigned = team.members.some((m, idx) => {
          if (idx === memberIndex) return false;
          return normalizeRole(m.role) === requestedRole;
        });
        if (roleAlreadyAssigned) {
          return res.status(400).json({
            success: false,
            message: `Only one ${requestedRole === 'captain' ? 'captain' : 'vice-captain'} is allowed per team`
          });
        }
      }
      team.members[memberIndex].role = requestedRole;
    }
    if (jerseyNumber) team.members[memberIndex].jerseyNumber = jerseyNumber;
    if (position) team.members[memberIndex].position = position;
    if (status) team.members[memberIndex].status = status;

    // If making someone vice-captain or captain
    if (normalizeRole(role) === 'captain') {
      const capId = team.captain?.toString?.();
      const currentCaptainIndex = capId
        ? team.members.findIndex(
          m => {
            if (!m.player) return false;
            const playerId = m.player._id ? m.player._id.toString() : m.player.toString();
            return playerId === capId;
          }
        )
        : -1;
      if (currentCaptainIndex !== -1) {
        team.members[currentCaptainIndex].role = 'player';
      }
      team.captain = req.params.memberId;
    }

    await team.save();

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get available players (users) for team creation - used by players/organizers
// @route   GET /api/teams/available-players
// @access  Private
export const getAvailablePlayers = async (req, res) => {
  try {
    const {
      search = '',
      limit = 200,
      sportsOnly = 'false',
      teamSportName = '',
      excludeIfInTeamSport,
    } = req.query;
    const shouldFilterSports = ['1', 'true', 'yes'].includes(String(sportsOnly).toLowerCase());
    const normalizedTeamSportName = normalizeSportText(teamSportName);
    const shouldExcludeBySportTeam = ['1', 'true', 'yes'].includes(
      String(excludeIfInTeamSport || '').toLowerCase(),
    );
    const query = {
      role: { $in: ['player', 'coach'] },
      isActive: true
    };
    if (search && search.trim()) {
      query.$or = [
        { firstName: { $regex: search.trim(), $options: 'i' } },
        { lastName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }
    const users = await User.find(query)
      .select('firstName lastName email phone profilePhoto')
      .sort({ firstName: 1 })
      .limit(Math.min(Number(limit) || 200, 500));

    // Optional: Exclude users who are already in any team for the same sport.
    // This enforces "one team per sport per player" across roles (academy/coach/organizer flows).
    // - Team.members.player stores User ids
    // - CoachTeam.members.player stores Player ids
    const excludedUserIds = new Set();
    const excludedPlayerProfileIds = new Set();
    if (shouldExcludeBySportTeam && normalizedTeamSportName) {
      // Resolve Sport id by name (best-effort) so we can filter Team collection efficiently.
      const sportDoc = await Sport.findOne({
        name: { $regex: `^${teamSportName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        isActive: true,
      })
        .select('_id name')
        .lean();

      if (sportDoc?._id) {
        const teams = await Team.find({ sport: sportDoc._id, isActive: true })
          .select('members.player members.poolPlayerId')
          .lean();
        const poolPlayerIds = new Set();
        for (const t of teams || []) {
          for (const m of t?.members || []) {
            if (m?.player) excludedUserIds.add(String(m.player));
            if (m?.poolPlayerId) poolPlayerIds.add(String(m.poolPlayerId));
          }
        }

        // Academy teams often store player linkage via poolPlayerId (Player collection).
        // Map those Player ids back to User ids so platform user lists can be filtered.
        if (poolPlayerIds.size > 0) {
          const poolPlayers = await Player.find({ _id: { $in: Array.from(poolPlayerIds) }, isActive: true })
            .select('_id user')
            .lean();
          for (const p of poolPlayers || []) {
            if (p?.user) excludedUserIds.add(String(p.user));
            excludedPlayerProfileIds.add(String(p._id));
          }
        }
      }

      // Coach teams store sportName and members.player as Player ids.
      const coachTeams = await CoachTeam.find({
        status: 'active',
        sportName: { $regex: `^${teamSportName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      })
        .select('members.player players.player')
        .lean();
      for (const t of coachTeams || []) {
        for (const m of t?.members || []) {
          if (m?.player) excludedPlayerProfileIds.add(String(m.player));
        }
        for (const p of t?.players || []) {
          if (p?.player) excludedPlayerProfileIds.add(String(p.player));
        }
      }
    }

    const userIds = users.map((u) => u._id);
    const playerProfiles = await Player.find({ user: { $in: userIds }, isActive: true })
      .select('user sports')
      .populate('sports.sport', 'name');

    const playerIdByUserId = new Map(
      playerProfiles.map((p) => [String(p.user), String(p._id)]),
    );

    const sportsCountByUserId = new Map(
      playerProfiles.map((p) => [String(p.user), Array.isArray(p.sports) ? p.sports.length : 0])
    );
    const matchedTeamSportByUserId = new Map(
      playerProfiles.map((p) => {
        const hasMatchedSport = (Array.isArray(p.sports) ? p.sports : []).some((entry) => {
          const direct = normalizeSportText(entry?.sportName);
          const linked = normalizeSportText(entry?.sport?.name);
          if (!normalizedTeamSportName) return Boolean(direct || linked);
          return direct === normalizedTeamSportName || linked === normalizedTeamSportName;
        });
        return [String(p.user), hasMatchedSport];
      })
    );

    const data = users.map(u => ({
      _id: u._id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unknown',
      email: u.email,
      phone: u.phone,
      profilePhoto: u.profilePhoto,
      sportCount: sportsCountByUserId.get(String(u._id)) || 0
    }))
      .filter((u) => {
        if (shouldExcludeBySportTeam && normalizedTeamSportName) {
          if (excludedUserIds.has(String(u._id))) return false;
          const pid = playerIdByUserId.get(String(u._id));
          if (pid && excludedPlayerProfileIds.has(String(pid))) return false;
        }
        if (!shouldFilterSports) return true;
        if ((u.sportCount || 0) <= 0) return false;
        if (!normalizedTeamSportName) return true;
        return Boolean(matchedTeamSportByUserId.get(String(u._id)));
      });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get available players error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get teams created by the current user
// @route   GET /api/teams/my
// @access  Private
export const getMyTeams = async (req, res) => {
  try {
    const userId = req.user._id;
    const teams = await Team.find({
      createdBy: userId,
      isActive: true
    })
      .populate('sport', 'name slug')
      .populate('captain', 'firstName lastName profilePhoto')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Register existing team for event
// @route   POST /api/teams/register-existing-for-event
// @access  Private
export const registerExistingTeamForEvent = async (req, res) => {
  try {
    const { eventId, teamId } = req.body;

    if (!eventId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and team ID are required'
      });
    }

    const event = await Event.findById(eventId).populate('sport');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.gameFormat !== 'team' && event.gameFormat !== 'doubles') {
      return res.status(400).json({
        success: false,
        message: 'This event is not a team event'
      });
    }

    const now = new Date();
    const startRaw = event?.registrationStartDate ? new Date(event.registrationStartDate) : null;
    const endRaw = event?.registrationEndDate ? new Date(event.registrationEndDate) : null;
    if (!startRaw || Number.isNaN(startRaw.getTime()) || !endRaw || Number.isNaN(endRaw.getTime())) {
      return res.status(400).json({ success: false, message: 'Registration is not open for this event' });
    }
    const start = new Date(startRaw);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endRaw);
    end.setHours(23, 59, 59, 999);
    if (now < start || now > end) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this event'
      });
    }

    const team = await Team.findById(teamId).populate('sport', 'name');
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (req.user.role === 'player') {
      const owner = team.createdBy ? await User.findById(team.createdBy).select('role') : null;
      const ownerRole = String(owner?.role || '').toLowerCase();
      if (!TEAM_OWNER_ASSIGNER_ROLES.includes(ownerRole)) {
        return res.status(403).json({
          success: false,
          message: 'Players can register only organizer/academy/coach assigned teams.'
        });
      }
    }

    // User must be captain or creator
    const isCaptain = team.captain && team.captain.toString() === req.user._id.toString();
    const isCreator = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!isCaptain && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can register this team for events'
      });
    }

    // Team sport must match event sport (compare by name since Sport and UserSport may be different collections)
    const teamSportName = (team.sport?.name || team.sportName || '').toString().toLowerCase();
    const eventSportName = (event.sport?.name || '').toString().toLowerCase();
    if (!teamSportName || !eventSportName || teamSportName !== eventSportName) {
      return res.status(400).json({
        success: false,
        message: 'Team sport does not match event sport'
      });
    }

    // Check if team already registered for this event (new collection first, legacy fallback)
    const [existingTeamReg, activeTeamRegs] = await Promise.all([
      EventTeamRegistration.findOne({ event: event._id, team: team._id, status: { $ne: 'withdrawn' } })
        .select('_id status')
        .lean(),
      EventTeamRegistration.find({ event: event._id, status: { $ne: 'withdrawn' } })
        .select('team')
        .lean()
    ]);
    const legacyAlreadyRegistered = (event.registeredTeams || []).some(
      r => r.team && r.team.toString() === teamId && r.status !== 'withdrawn'
    );
    if (existingTeamReg || legacyAlreadyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'This team is already registered for this event'
      });
    }

    // Check if user already has another team registered for this event
    const activeTeamIds =
      (activeTeamRegs && activeTeamRegs.length > 0)
        ? activeTeamRegs.map((r) => r.team?.toString?.() || String(r.team))
        : (event.registeredTeams || [])
            .filter(r => r.status !== 'withdrawn' && r.team)
            .map(r => r.team.toString());
    const otherTeams = await Team.find({ _id: { $in: activeTeamIds } }).select('captain createdBy');
    const hasOtherRegistration = otherTeams.some(
      t => t._id.toString() !== teamId &&
        (t.captain?.toString() === req.user._id.toString() || t.createdBy?.toString() === req.user._id.toString())
    );
    if (hasOtherRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You already have another team registered for this event'
      });
    }

    // Validate team size
    const { teamSize } = event.registrationSettings || {};
    const minMembers = teamSize?.min || 1;
    const maxMembers = teamSize?.max || 20;
    const memberCount = team.members?.length || 0;
    if (memberCount < minMembers) {
      return res.status(400).json({
        success: false,
        message: `Team must have at least ${minMembers} members (current: ${memberCount})`
      });
    }
    if (memberCount > maxMembers) {
      return res.status(400).json({
        success: false,
        message: `Team cannot have more than ${maxMembers} members (current: ${memberCount})`
      });
    }

    const feeStatus = event.registrationFee > 0 ? 'registered' : 'confirmed';
    const payStatus = event.registrationFee > 0 ? 'pending' : 'completed';

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const before = await EventTeamRegistration.findOne({ event: event._id, team: team._id })
          .session(session)
          .lean();
        const reg = await EventTeamRegistration.findOneAndUpdate(
          { event: event._id, team: team._id },
          {
            $set: {
              registrationDate: new Date(),
              paymentStatus: payStatus,
              status: feeStatus,
              registeredBy: req.user._id,
              withdrawnAt: null
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, session }
        );

        await auditEvent({
          entityType: 'event_team_registration',
          entityId: reg._id,
          action: before ? 're_registered' : 'created',
          actor: req.user._id,
          before,
          after: reg.toObject(),
          metadata: { eventId: event._id, teamId: team._id },
          session
        });

        // Legacy mirror (best-effort)
        const legacyRow = (event.registeredTeams || []).find(
          (rt) => rt.team && String(rt.team) === String(team._id)
        );
        if (legacyRow) {
          legacyRow.registrationDate = new Date();
          legacyRow.paymentStatus = payStatus;
          legacyRow.status = feeStatus;
        } else {
          event.registeredTeams.push({
            team: team._id,
            registrationDate: new Date(),
            paymentStatus: payStatus,
            status: feeStatus
          });
        }
        await event.save({ session });
      });
    } finally {
      session.endSession();
    }

    // Notify organizer
    await Notification.create({
      recipient: event.organizer,
      sender: req.user._id,
      type: 'registration_confirmed',
      title: 'Team Registration',
      message: `Team "${team.name}" has been registered for "${event.name}".`,
      data: { eventId: event._id, teamId: team._id }
    });

    await Notification.create({
      recipient: req.user._id,
      sender: event.organizer,
      type: 'registration_confirmed',
      title: 'Team Registered Successfully',
      message: `Your team "${team.name}" has been registered for "${event.name}".`,
      data: { eventId: event._id, teamId: team._id }
    });

    res.status(201).json({
      success: true,
      message: 'Team registered successfully',
      data: {
        team,
        requiresPayment: event.registrationFee > 0,
        paymentAmount: event.registrationFee,
        currency: event.currency
      }
    });
  } catch (error) {
    console.error('Register existing team for event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get teams where user is a member (by player ID or by email/name in members)
// @route   GET /api/teams/user/:userId
// @access  Public
export const getTeamsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).select('email');
    const userEmail = user?.email?.trim?.();

    const query = {
      isActive: true,
      $or: [{ 'members.player': userId }]
    };
    if (userEmail) {
      const escaped = userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or.push({ 'members.email': new RegExp(`^${escaped}$`, 'i') });
    }

    const teams = await Team.find(query)
      .populate('captain', 'firstName lastName profilePhoto')
      .populate('sport', 'name slug')
      .populate('createdBy', 'firstName lastName role');

    const normalizedEmail = userEmail ? userEmail.toLowerCase() : '';
    const data = teams.map((teamDoc) => {
      const team = teamDoc.toObject();
      const myMember = (team.members || []).find((member) => {
        const byPlayer = member?.player?.toString?.() === userId;
        const byEmail =
          !!normalizedEmail &&
          typeof member?.email === 'string' &&
          member.email.trim().toLowerCase() === normalizedEmail;
        return byPlayer || byEmail;
      });

      const myRole = myMember?.role || 'player';
      const isCaptainAssigned =
        myRole === 'captain' ||
        team?.captain?._id?.toString?.() === userId ||
        team?.captain?.toString?.() === userId;

      return {
        ...team,
        myRole,
        isCaptainAssigned,
        assignedByRole: team?.createdBy?.role || null,
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get teams by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get coach teams where user is a member (via Player.user)
// @route   GET /api/teams/user/:userId/coach-teams
// @access  Public
export const getCoachTeamsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const players = await Player.find({ user: userId }).select('_id');
    const playerIds = players.map((p) => p._id);
    if (playerIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const coachTeams = await CoachTeam.find({ 'members.player': { $in: playerIds } })
      .populate('coach', 'firstName lastName')
      .populate('sport', 'name slug');
    res.json({ success: true, data: coachTeams });
  } catch (error) {
    console.error('Get coach teams by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add achievement to team
// @route   POST /api/teams/:id/achievements
// @access  Private (Captain)
export const addAchievement = async (req, res) => {
  try {
    const { title, description, date, eventId } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (!canManageStandardTeamRoster(team, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can add achievements'
      });
    }

    team.achievements.push({ title, description, date, eventId });
    await team.save();

    res.json({
      success: true,
      message: 'Achievement added successfully',
      data: team.achievements
    });
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Invite player to team
// @route   POST /api/teams/:id/invite
// @access  Private (Captain)
export const invitePlayer = async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    let allowed = canManageStandardTeamRoster(team, req.user);
    if (!allowed && team.captain) {
      const myPlayer = await Player.findOne({ user: req.user._id }).select('_id');
      const isCaptainByPoolPlayer = Boolean(
        myPlayer?._id && team.captain.toString() === myPlayer._id.toString()
      );
      allowed = isCaptainByPoolPlayer;
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can invite players'
      });
    }

    // Find user by email
    const player = await User.findOne({ email: normalizedEmail });
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Check if already a member
    const isMember = (team.members || []).some((m) => {
      const memberPlayerId = m?.player?._id ? m.player._id.toString() : m?.player?.toString?.();
      const memberEmail = String(m?.email || '').trim().toLowerCase();
      return memberPlayerId === player._id.toString() || memberEmail === normalizedEmail;
    });
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Player is already invited or a team member'
      });
    }

    // Persist invite as pending member so UI can exclude invited players from dropdown.
    team.members.push({
      player: player._id,
      name: [player.firstName, player.lastName].filter(Boolean).join(' ').trim() || player.email || 'Player',
      email: normalizedEmail,
      role: 'player',
      status: 'pending',
      joinedAt: new Date(),
    });
    await team.save();

    // Send invitation notification
    await Notification.create({
      recipient: player._id,
      sender: req.user._id,
      type: 'team_invitation',
      title: 'Team Join Request',
      message: `You received a join request for team "${team.name}". Open Team Invites to accept or reject.`,
      data: { teamId: team._id }
    });

    res.json({
      success: true,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Invite player error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const registerTeamForEvent = async (req, res) => {
  try {
    if (req.user.role === 'player') {
      return res.status(403).json({
        success: false,
        message: 'Players cannot create new event teams. Use an assigned existing team.'
      });
    }

    const {
      eventId,
      teamName,
      members // Array of member details with role, name, email, phone, position, jerseyNumber, etc.
    } = req.body;

    // Fetch event with sport details
    const event = await Event.findById(eventId).populate('sport');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event is for teams (team or doubles format)
    if (event.gameFormat !== 'team' && event.gameFormat !== 'doubles') {
      return res.status(400).json({
        success: false,
        message: 'This event is not a team event'
      });
    }

    // Check if registration is open
    const now = new Date();
    if (now < new Date(event.registrationStartDate) || now > new Date(event.registrationEndDate)) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this event'
      });
    }

    // Check if captain already has an active team registered (excluding withdrawn teams)
    const captainActiveTeams = await Team.find({
      captain: req.user._id,
      event: eventId,
      isActive: true
    });

    const activeTeamRegistrations = event.registeredTeams.filter(
      t => t.status !== 'withdrawn'
    ).length;

    // Check if max teams reached (excluding withdrawn teams)
    if (event.registrationSettings?.maxTeams && activeTeamRegistrations >= event.registrationSettings.maxTeams) {
      // Check if captain has a withdrawn team that can be re-registered
      const captainWithdrawnTeam = event.registeredTeams.find(
        async (t) => {
          const team = await Team.findById(t.team);
          return team && team.captain.toString() === req.user._id.toString() && t.status === 'withdrawn';
        }
      );

      if (!captainWithdrawnTeam) {
        return res.status(400).json({
          success: false,
          message: 'Maximum team limit reached for this event'
        });
      }
    }

    // Validate team size
    const { teamSize } = event.registrationSettings || {};
    const minMembers = teamSize?.min || 1;
    const maxMembers = teamSize?.max || 20;

    if (!members || members.length < minMembers) {
      return res.status(400).json({
        success: false,
        message: `Team must have at least ${minMembers} members`
      });
    }

    if (members.length > maxMembers) {
      return res.status(400).json({
        success: false,
        message: `Team cannot have more than ${maxMembers} members`
      });
    }

    // Validate captain and vice-captain
    const leadershipError = validateSingleLeadership(members);
    if (leadershipError) {
      return res.status(400).json({ success: false, message: leadershipError });
    }

    const captainMember = members.find(m => normalizeRole(m.role) === 'captain');
    const viceCaptainMember = members.find(m => normalizeRole(m.role) === 'vice_captain');

    if (event.registrationSettings?.requiresCaptain && !captainMember) {
      return res.status(400).json({
        success: false,
        message: 'Team must have a captain'
      });
    }

    if (event.registrationSettings?.requiresViceCaptain && !viceCaptainMember) {
      return res.status(400).json({
        success: false,
        message: 'Team must have a vice-captain'
      });
    }

    // Validate required fields for members
    const requiredFields = event.registrationSettings?.memberRequiredFields || ['name'];
    for (const member of members) {
      for (const field of requiredFields) {
        if (!member[field]) {
          return res.status(400).json({
            success: false,
            message: `${field} is required for all team members`
          });
        }
      }
    }

    // Check if user has already registered a team for this event
    const existingTeam = await Team.findOne({
      event: eventId,
      createdBy: req.user._id
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered a team for this event'
      });
    }

    // Prepare members data
    const teamMembers = members.map(member => ({
      player: member.playerId || null, // If member is a registered user
      role: normalizeRole(member.role) || 'player',
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      dateOfBirth: member.dateOfBirth || null,
      gender: member.gender || null,
      position: member.position || '',
      jerseyNumber: member.jerseyNumber || null,
      photo: member.photo || '',
      idProof: member.idProof || '',
      status: 'active'
    }));

    // Create team
    const team = await Team.create({
      name: teamName,
      sport: event.sport._id,
      sportName: event.sport.name,
      event: eventId,
      teamType: 'event_specific',
      captain: captainMember?.playerId || req.user._id,
      viceCaptain: viceCaptainMember?.playerId || null,
      members: teamMembers,
      createdBy: req.user._id,
      registrationStatus: event.registrationFee > 0 ? 'pending' : 'approved',
      paymentStatus: event.registrationFee > 0 ? 'pending' : 'completed'
    });

    const feeStatus = event.registrationFee > 0 ? 'registered' : 'confirmed';
    const payStatus = event.registrationFee > 0 ? 'pending' : 'completed';

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const before = await EventTeamRegistration.findOne({ event: event._id, team: team._id })
          .session(session)
          .lean();
        const reg = await EventTeamRegistration.findOneAndUpdate(
          { event: event._id, team: team._id },
          {
            $set: {
              registrationDate: new Date(),
              paymentStatus: payStatus,
              status: feeStatus,
              registeredBy: req.user._id,
              withdrawnAt: null
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, session }
        );

        await auditEvent({
          entityType: 'event_team_registration',
          entityId: reg._id,
          action: before ? 're_registered' : 'created',
          actor: req.user._id,
          before,
          after: reg.toObject(),
          metadata: { eventId: event._id, teamId: team._id, source: 'team_create_and_register' },
          session
        });

        // Legacy mirror (best-effort)
        const legacyRow = (event.registeredTeams || []).find(
          (rt) => rt.team && String(rt.team) === String(team._id)
        );
        if (legacyRow) {
          legacyRow.registrationDate = new Date();
          legacyRow.paymentStatus = payStatus;
          legacyRow.status = feeStatus;
        } else {
          event.registeredTeams.push({
            team: team._id,
            registrationDate: new Date(),
            paymentStatus: payStatus,
            status: feeStatus
          });
        }

        await event.save({ session });
      });
    } finally {
      session.endSession();
    }

    // Notify organizer
    await Notification.create({
      recipient: event.organizer,
      sender: req.user._id,
      type: 'registration_confirmed',
      title: 'New Team Registration',
      message: `Team "${teamName}" has registered for "${event.name}".`,
      data: { eventId: event._id, teamId: team._id }
    });

    // Notify team creator
    await Notification.create({
      recipient: req.user._id,
      sender: event.organizer,
      type: 'registration_confirmed',
      title: 'Team Registration Successful',
      message: `Your team "${teamName}" has been registered for "${event.name}".`,
      data: { eventId: event._id, teamId: team._id }
    });

    // Populate team data for response
    await team.populate('sport', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Team registered successfully',
      data: {
        team,
        requiresPayment: event.registrationFee > 0,
        paymentAmount: event.registrationFee,
        currency: event.currency
      }
    });
  } catch (error) {
    console.error('Register team for event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update team registration for event
// @route   PUT /api/teams/:id/event-registration
// @access  Private (Captain)
export const updateTeamRegistration = async (req, res) => {
  try {
    const { members, teamName } = req.body;
    const team = await Team.findById(req.params.id).populate('event');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    const isCaptainUser = team.captain && team.captain.toString() === req.user._id.toString();
    const isCreatorUser = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!isCaptainUser && !isCreatorUser && !canManageStandardTeamRoster(team, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain or creator can update registration'
      });
    }

    // Check if registration is still open
    const event = team.event;
    if (event) {
      const now = new Date();
      if (now > new Date(event.registrationEndDate)) {
        return res.status(400).json({
          success: false,
          message: 'Registration period has ended'
        });
      }
    }

    // Update team name if provided
    if (teamName) {
      team.name = teamName;
    }

    // Update members if provided
    if (members && Array.isArray(members)) {
      const leadershipError = validateSingleLeadership(members);
      if (leadershipError) {
        return res.status(400).json({ success: false, message: leadershipError });
      }

      team.members = members.map(member => ({
        player: member.playerId || null,
        role: normalizeRole(member.role) || 'player',
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        dateOfBirth: member.dateOfBirth || null,
        gender: member.gender || null,
        position: member.position || '',
        jerseyNumber: member.jerseyNumber || null,
        photo: member.photo || '',
        idProof: member.idProof || '',
        status: member.status || 'active'
      }));

      // Update captain and vice-captain references
      const captain = members.find(m => normalizeRole(m.role) === 'captain');
      const viceCaptain = members.find(m => normalizeRole(m.role) === 'vice_captain');

      if (captain?.playerId) {
        team.captain = captain.playerId;
      }
      if (viceCaptain?.playerId) {
        team.viceCaptain = viceCaptain.playerId;
      } else {
        team.viceCaptain = null;
      }
    }

    await team.save();

    res.json({
      success: true,
      message: 'Team registration updated successfully',
      data: team
    });
  } catch (error) {
    console.error('Update team registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get my teams for events
// @route   GET /api/teams/my-event-teams
// @access  Private
export const getMyEventTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      createdBy: req.user._id,
      teamType: 'event_specific'
    })
      .populate('sport', 'name slug icon')
      .populate('event', 'name startDate endDate status registrationFee')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get my event teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event registration requirements
// @route   GET /api/teams/event-requirements/:eventId
// @access  Public
export const getEventRegistrationRequirements = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('sport', 'name teamSettings formats');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const requirements = {
      eventId: event._id,
      eventName: event.name,
      gameFormat: event.gameFormat,
      sport: event.sport,
      registrationSettings: event.registrationSettings,
      registrationFee: event.registrationFee,
      qr_code_image: event.qr_code_image || '',
      currency: event.currency,
      registrationOpen: (() => {
        const now = new Date();
        const startRaw = event?.registrationStartDate ? new Date(event.registrationStartDate) : null;
        const endRaw = event?.registrationEndDate ? new Date(event.registrationEndDate) : null;
        if (!startRaw || Number.isNaN(startRaw.getTime()) || !endRaw || Number.isNaN(endRaw.getTime())) return false;
        const start = new Date(startRaw);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endRaw);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      })(),
      registrationStartDate: event.registrationStartDate,
      registrationEndDate: event.registrationEndDate,
      registeredTeamsCount: event.registeredTeams?.length || 0,
      maxTeams: event.registrationSettings?.maxTeams || null
    };

    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    console.error('Get event requirements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==========================================
// ACADEMY TEAM MANAGEMENT
// ==========================================

// @desc    Create a team for an academy
// @route   POST /api/teams/academy
// @access  Private/AcademyAdmin
export const createAcademyTeam = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const {
      name, description, sport, sportName, teamType, location, contactEmail, contactPhone, members,
      ageCategory, gameFormat, genderCategory, maxPlayers, minPlayers, maxSubstitutes, playingSize,
      coachName, managerName, primaryColor, secondaryColor, trainingSchedule, entryFee
    } = req.body;

    if (!name || !sport) {
      return res.status(400).json({ success: false, message: 'Team name and sport are required' });
    }

    const leadershipError = validateSingleLeadership(members || []);
    if (leadershipError) {
      return res.status(400).json({ success: false, message: leadershipError });
    }

    const existingTeam = await Team.findOne({ name, sport, academy: academy._id });
    if (existingTeam) {
      return res.status(400).json({ success: false, message: 'A team with this name already exists for this sport in your academy' });
    }

    const team = await Team.create({
      name,
      description: description || '',
      sport,
      sportName: sportName || '',
      academy: academy._id,
      teamType: teamType || 'permanent',
      ageCategory: ageCategory || 'open',
      gameFormat: gameFormat || 'team',
      genderCategory: genderCategory || 'male',
      maxPlayers: maxPlayers || 0,
      minPlayers: minPlayers || 0,
      maxSubstitutes: maxSubstitutes || 0,
      playingSize: playingSize || 0,
      coachName: coachName || '',
      managerName: managerName || '',
      primaryColor: primaryColor || '',
      secondaryColor: secondaryColor || '',
      trainingSchedule: trainingSchedule || '',
      entryFee: entryFee || 0,
      captain: (members || []).find(m => m.role === 'captain')?.poolPlayerId || null,
      createdBy: req.user._id,
      location: location || { city: academy.address?.city, state: academy.address?.state, country: academy.address?.country },
      contactEmail: contactEmail || academy.email,
      contactPhone: contactPhone || academy.phone,
      members: members || [],
      registrationStatus: 'approved',
      isActive: true
    });

    // Sync Player model — add this team to each pool player's teams array
    const poolPlayerIds = (members || []).map(m => m.poolPlayerId).filter(Boolean);
    if (poolPlayerIds.length > 0) {
      await Player.updateMany(
        { _id: { $in: poolPlayerIds } },
        { $addToSet: { teams: team._id } }
      );
    }

    await team.populate('sport', 'name slug');

    res.status(201).json({ success: true, message: 'Team created successfully', data: team });
  } catch (error) {
    console.error('Create academy team error:', error);
    res.status(500).json({ success: false, message: 'Error creating team', error: error.message });
  }
};

// @desc    Get all teams for an academy
// @route   GET /api/teams/academy/my
// @access  Private/AcademyAdmin
export const getMyAcademyTeams = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const teams = await Team.find({ academy: academy._id, isActive: true })
      .populate('sport', 'name slug')
      .populate('captain', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: teams.length, data: teams });
  } catch (error) {
    console.error('Get academy teams error:', error);
    res.status(500).json({ success: false, message: 'Error fetching teams', error: error.message });
  }
};

// @desc    Update an academy team
// @route   PUT /api/teams/academy/:id
// @access  Private/AcademyAdmin
export const updateAcademyTeam = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const team = await Team.findOne({ _id: req.params.id, academy: academy._id });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const {
      name, description, sport, sportName, teamType, location, contactEmail, contactPhone, members,
      ageCategory, gameFormat, genderCategory, maxPlayers, minPlayers, maxSubstitutes, playingSize,
      coachName, managerName, primaryColor, secondaryColor, trainingSchedule, entryFee
    } = req.body;

    if (name !== undefined) team.name = name;
    if (description !== undefined) team.description = description;
    if (sport !== undefined) team.sport = sport;
    if (sportName !== undefined) team.sportName = sportName;
    if (teamType !== undefined) team.teamType = teamType;
    if (ageCategory !== undefined) team.ageCategory = ageCategory;
    if (gameFormat !== undefined) team.gameFormat = gameFormat;
    if (genderCategory !== undefined) team.genderCategory = genderCategory;
    if (maxPlayers !== undefined) team.maxPlayers = maxPlayers;
    if (minPlayers !== undefined) team.minPlayers = minPlayers;
    if (maxSubstitutes !== undefined) team.maxSubstitutes = maxSubstitutes;
    if (playingSize !== undefined) team.playingSize = playingSize;
    if (coachName !== undefined) team.coachName = coachName;
    if (managerName !== undefined) team.managerName = managerName;
    if (primaryColor !== undefined) team.primaryColor = primaryColor;
    if (secondaryColor !== undefined) team.secondaryColor = secondaryColor;
    if (trainingSchedule !== undefined) team.trainingSchedule = trainingSchedule;
    if (entryFee !== undefined) team.entryFee = entryFee;
    if (location !== undefined) team.location = location;
    if (contactEmail !== undefined) team.contactEmail = contactEmail;
    if (contactPhone !== undefined) team.contactPhone = contactPhone;
    if (members !== undefined) {
      const leadershipError = validateSingleLeadership(members || []);
      if (leadershipError) {
        return res.status(400).json({ success: false, message: leadershipError });
      }

      team.members = members;

      // Set captain/vice-captain from members roles
      const captainMember = members.find(m => m.role === 'captain');
      const viceCaptainMember = members.find(m => m.role === 'vice_captain');

      if (captainMember) {
        team.captain = captainMember.poolPlayerId || captainMember.player || null;
      } else if (viceCaptainMember) {
        team.captain = viceCaptainMember.poolPlayerId || viceCaptainMember.player || null;
      } else if (members.length === 0) {
        team.captain = null;
      } else {
        team.captain = null;
      }
    }

    await team.save();
    await team.populate('sport', 'name slug');

    res.status(200).json({ success: true, message: 'Team updated successfully', data: team });
  } catch (error) {
    console.error('Update academy team error:', error);
    res.status(500).json({ success: false, message: 'Error updating team', error: error.message });
  }
};

// @desc    Invite a player by email to academy team (pending member)
// @route   POST /api/teams/academy/:id/invite-email
// @access  Private/AcademyAdmin
export const inviteAcademyPlayerByEmail = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const team = await Team.findOne({ _id: req.params.id, academy: academy._id, isActive: true });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const { email, role = 'player' } = req.body;
    const requestedRole = normalizeRole(role);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.role !== 'player') {
      return res.status(404).json({ success: false, message: 'No player account found with this email' });
    }

    let player = await Player.findOne({ user: user._id });
    if (!player) {
      player = await Player.create({
        user: user._id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Player',
        email: user.email || normalizedEmail,
        phone: user.phone || '',
        academies: [academy._id],
      });
    } else {
      player.academies = player.academies || [];
      const existsInAcademy = player.academies.some((a) => a.toString() === academy._id.toString());
      if (!existsInAcademy) player.academies.push(academy._id);
      await player.save();
    }

    const alreadyMember = (team.members || []).some((m) => (
      (m.poolPlayerId && m.poolPlayerId.toString() === player._id.toString()) ||
      (m.player && m.player.toString() === user._id.toString()) ||
      (m.email && m.email.toLowerCase() === normalizedEmail)
    ));
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'Player is already in this team' });
    }

    if (LEADERSHIP_ROLES.includes(requestedRole)) {
      const roleAlreadyAssigned = (team.members || []).some((m) => normalizeRole(m.role) === requestedRole);
      if (roleAlreadyAssigned) {
        return res.status(400).json({
          success: false,
          message: `Only one ${requestedRole === 'captain' ? 'captain' : 'vice-captain'} is allowed per team`
        });
      }
    }

    team.members.push({
      player: user._id,
      poolPlayerId: player._id,
      name: player.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Player',
      email: normalizedEmail,
      phone: player.phone || user.phone || '',
      role: requestedRole,
      status: 'pending',
      joinedAt: new Date(),
    });
    await team.save();

    await Notification.create({
      recipient: user._id,
      sender: req.user._id,
      type: 'team_invitation',
      title: 'Team Join Request',
      message: `Academy sent a join request for team "${team.name}". Open Team Invites to accept or reject.`,
      data: { teamId: team._id },
    });

    return res.status(200).json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite academy player by email error:', error);
    return res.status(500).json({ success: false, message: 'Error sending invitation', error: error.message });
  }
};

// @desc    Get pending team invitations for logged-in player (Team model)
// @route   GET /api/teams/player/invites
// @access  Private/Player
export const getPlayerTeamInvites = async (req, res) => {
  try {
    const teams = await Team.find({
      isActive: true,
      members: { $elemMatch: { player: req.user._id, status: 'pending' } }
    })
      .populate('sport', 'name slug')
      .populate('academy', 'name logo')
      .populate('createdBy', 'firstName lastName role');

    const teamIds = teams.map((team) => team._id);
    const inviteNotifications = await Notification.find({
      recipient: req.user._id,
      type: 'team_invitation',
      'data.teamId': { $in: teamIds }
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'firstName lastName role');

    // Keep only latest invite notification per team.
    const latestInviteByTeamId = new Map();
    for (const notification of inviteNotifications) {
      const teamId = notification?.data?.teamId?.toString?.() || '';
      if (!teamId || latestInviteByTeamId.has(teamId)) continue;
      latestInviteByTeamId.set(teamId, notification);
    }

    const data = teams.map((team) => {
      const invite = (team.members || []).find(
        (m) => m.player?.toString?.() === req.user._id.toString() && m.status === 'pending'
      );
      const latestInviteNotification = latestInviteByTeamId.get(team._id.toString());
      const inviterFromNotification = latestInviteNotification?.sender || null;
      const fallbackInviter = team.createdBy || null;
      const inviter = inviterFromNotification || fallbackInviter;

      const inviterUserId = inviter?._id?.toString?.() || '';
      const captainUserId = team.captain?.toString?.() || '';
      const isInvitedByCaptain = inviterUserId && (
        inviterUserId === captainUserId ||
        (team.members || []).some((m) => (
          String(m?.role || '').toLowerCase() === 'captain' &&
          m?.player?.toString?.() === inviterUserId
        ))
      );
      const inviterRole = String(inviter?.role || '').toLowerCase();
      const inviterType = isInvitedByCaptain
        ? 'captain'
        : inviterRole === 'coach'
          ? 'coach'
          : inviterRole === 'academyadmin'
            ? 'academyadmin'
            : 'academy';

      return {
        _id: team._id,
        teamName: team.name,
        sport: team.sport,
        sportName: team.sportName || team.sport?.name || '',
        academy: team.academy || null,
        invitedBy: inviter,
        invitedByType: inviterType,
        invite: invite
          ? {
              role: invite.role,
              position: invite.position || '',
              jerseyNumber: invite.jerseyNumber,
              invitedAt: invite.joinedAt || team.updatedAt
            }
          : null
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get player team invites error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching invitations', error: error.message });
  }
};

// @desc    Accept/Reject team invitation for logged-in player (Team model)
// @route   PUT /api/teams/:id/respond-invite
// @access  Private/Player
export const respondToPlayerTeamInvite = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be accept or reject' });
    }

    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const memberIndex = (team.members || []).findIndex(
      (m) => m.player?.toString?.() === req.user._id.toString()
    );
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (action === 'accept') {
      if (team.members[memberIndex].status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invitation is not pending' });
      }

      // Business rule: player can have only one active team per sport.
      const playerProfile = await Player.findOne({ user: req.user._id });
      const [activeAcademyTeamSameSport, activeCoachTeamSameSport] = await Promise.all([
        Team.findOne({
          _id: { $ne: team._id },
          isActive: true,
          sport: team.sport,
          members: { $elemMatch: { player: req.user._id, status: 'active' } }
        }).select('name'),
        playerProfile
          ? CoachTeam.findOne({
              sport: team.sport,
              members: { $elemMatch: { player: playerProfile._id, status: 'active' } }
            }).select('name')
          : Promise.resolve(null)
      ]);

      if (activeAcademyTeamSameSport || activeCoachTeamSameSport) {
        return res.status(400).json({
          success: false,
          message: 'You can only join one active team per sport. Leave your current team before accepting this invite.'
        });
      }

      team.members[memberIndex].status = 'active';
      team.members[memberIndex].joinedAt = new Date();
    } else {
      team.members.splice(memberIndex, 1);
    }

    await team.save();

    if (action === 'accept') {
      const player = await Player.findOne({ user: req.user._id });
      if (player) {
        player.teams = player.teams || [];
        if (!player.teams.some((t) => t.toString() === team._id.toString())) {
          player.teams.push(team._id);
          await player.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: action === 'accept' ? 'Invitation accepted' : 'Invitation rejected'
    });
  } catch (error) {
    console.error('Respond to player team invite error:', error);
    return res.status(500).json({ success: false, message: 'Error updating invitation', error: error.message });
  }
};

// @desc    Leave team as logged-in player (academy/general Team model)
// @route   PUT /api/teams/:id/leave
// @access  Private/Player
export const leaveTeamAsPlayer = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team || !team.isActive) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const leavingMember = (team.members || []).find(
      (m) => m.player?.toString?.() === req.user._id.toString()
    );
    const before = (team.members || []).length;
    team.members = (team.members || []).filter(
      (m) => m.player?.toString?.() !== req.user._id.toString()
    );

    if (before === team.members.length) {
      return res.status(404).json({ success: false, message: 'You are not a member of this team' });
    }

    // If captain leaves, reassign captain to active vice-captain or next active member.
    const isLeavingCaptain =
      team.captain?.toString?.() === req.user._id.toString() ||
      leavingMember?.role === 'captain';
    if (isLeavingCaptain) {
      const nextCaptainMember =
        (team.members || []).find((m) => m.status === 'active' && m.role === 'vice_captain') ||
        (team.members || []).find((m) => m.status === 'active' && m.player);
      team.captain = nextCaptainMember?.player || null;
    }

    await team.save();

    const player = await Player.findOne({ user: req.user._id });
    if (player?.teams?.length) {
      player.teams = player.teams.filter((t) => t.toString() !== team._id.toString());
      await player.save();
    }

    return res.status(200).json({ success: true, message: 'You left the team successfully' });
  } catch (error) {
    console.error('Leave team as player error:', error);
    return res.status(500).json({ success: false, message: 'Error leaving team', error: error.message });
  }
};

// @desc    Delete (deactivate) an academy team
// @route   DELETE /api/teams/academy/:id
// @access  Private/AcademyAdmin
export const deleteAcademyTeam = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const team = await Team.findOne({ _id: req.params.id, academy: academy._id });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    team.isActive = false;
    await team.save();

    res.status(200).json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete academy team error:', error);
    res.status(500).json({ success: false, message: 'Error deleting team', error: error.message });
  }
};