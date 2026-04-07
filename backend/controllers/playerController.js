import mongoose from 'mongoose';
import Player from '../models/Player.js';
import User from '../models/User.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Team from '../models/Team.js';
import Sport from '../models/Sport.js';
import RoleSportAuditTrail from '../models/RoleSportAuditTrail.js';
import Coach from '../models/Coach.js';
import UserSport from '../models/UserSport.js';
import Event from '../models/Event.js';

const PLAYER_SPORT_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'professional', '']);

const sanitizePlayerSportsPayload = (raw) => {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const sid = entry.sport != null ? String(entry.sport).trim() : '';
    if (!mongoose.Types.ObjectId.isValid(sid)) continue;
    if (seen.has(sid)) continue;
    seen.add(sid);
    let jerseyNumber = null;
    if (entry.jerseyNumber != null && entry.jerseyNumber !== '') {
      const n = Number(entry.jerseyNumber);
      jerseyNumber = Number.isFinite(n) ? n : null;
    }
    const levelRaw = String(entry.level || '').trim().toLowerCase();
    const level = PLAYER_SPORT_LEVELS.has(levelRaw) ? levelRaw : '';
    out.push({
      sport: new mongoose.Types.ObjectId(sid),
      sportName: String(entry.sportName || '').trim(),
      position: String(entry.position || '').trim(),
      jerseyNumber,
      level,
    });
  }
  return out;
};

/**
 * @desc    Get all players for the academy (with pagination, search, filter)
 * @route   GET /api/player/academy
 * @access  Private (academyadmin)
 */
export const getAcademyPlayers = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy) {
      return res.status(404).json({ success: false, message: 'Academy not found' });
    }

    const {
      page = 1,
      limit = 50,
      search = '',
      status,
      gender,
      sort = '-createdAt',
      sportId,
      excludeIfInTeamSport,
      ignoreTeamId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(500, parseInt(limit)));

    const query = { academies: academy._id, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (gender) query.gender = gender;

    // Optional: exclude players who are already part of ANY team in this academy for the given sport.
    // Used by "Create Team" flow so a player can't be added to multiple teams of the same sport.
    const shouldExcludeBySportTeam =
      String(excludeIfInTeamSport || '').trim().toLowerCase() === 'true' ||
      String(excludeIfInTeamSport || '').trim() === '1';
    const sportIdStr = sportId != null ? String(sportId).trim() : '';
    const ignoreTeamIdStr = ignoreTeamId != null ? String(ignoreTeamId).trim() : '';
    if (
      shouldExcludeBySportTeam &&
      sportIdStr &&
      mongoose.Types.ObjectId.isValid(sportIdStr)
    ) {
      const teamQuery = {
        academy: academy._id,
        sport: new mongoose.Types.ObjectId(sportIdStr),
        isActive: true,
      };
      if (ignoreTeamIdStr && mongoose.Types.ObjectId.isValid(ignoreTeamIdStr)) {
        teamQuery._id = { $ne: new mongoose.Types.ObjectId(ignoreTeamIdStr) };
      }

      const teams = await Team.find(teamQuery).select('members.player members.poolPlayerId').lean();

      const poolPlayerIds = new Set();
      const userIds = new Set();
      for (const t of teams || []) {
        for (const m of t?.members || []) {
          if (m?.poolPlayerId) poolPlayerIds.add(String(m.poolPlayerId));
          if (m?.player) userIds.add(String(m.player));
        }
      }

      if (poolPlayerIds.size > 0) {
        query._id = { ...(query._id || {}), $nin: Array.from(poolPlayerIds) };
      }
      if (userIds.size > 0) {
        query.user = { ...(query.user || {}), $nin: Array.from(userIds) };
      }
    }

    const totalRecords = await Player.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const players = await Player.find(query)
      .populate('teams', 'name primaryColor')
      .populate('sports.sport', 'name slug')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: players.length,
      totalRecords,
      totalPages,
      currentPage: pageNum,
      data: players,
    });
  } catch (error) {
    console.error('Get academy players error:', error);
    res.status(500).json({ success: false, message: 'Error fetching players', error: error.message });
  }
};

/**
 * @desc    Get a single player by ID
 * @route   GET /api/player/:id
 * @access  Private (academyadmin)
 */
export const getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('teams', 'name primaryColor sport')
      .populate('user', 'firstName lastName email')
      .populate('sports.sport', 'name slug')
      .populate('academies', 'name logo');

    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || !player.academies.some(a => a._id.toString() === academy._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this player' });
    }

    res.status(200).json({ success: true, data: player });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ success: false, message: 'Error fetching player', error: error.message });
  }
};

/**
 * @desc    Update a player
 * @route   PUT /api/player/:id
 * @access  Private (academyadmin)
 */
export const updatePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || !player.academies.some(a => a.toString() === academy._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { name, email, phone, dateOfBirth, gender, position, jerseyNumber, photo, status, sports } = req.body;

    if (name !== undefined) player.name = name.trim();
    if (email !== undefined) player.email = email;
    if (phone !== undefined) player.phone = phone;
    if (dateOfBirth !== undefined) player.dateOfBirth = dateOfBirth || null;
    if (gender !== undefined) player.gender = gender;
    if (position !== undefined) player.position = position;
    if (jerseyNumber !== undefined) player.jerseyNumber = jerseyNumber != null && jerseyNumber !== '' ? Number(jerseyNumber) : null;
    if (photo !== undefined) player.photo = photo;
    if (status !== undefined) player.status = status;
    if (sports !== undefined) player.sports = Array.isArray(sports) ? sports : [];

    await player.save();

    if (player.teams?.length > 0) {
      const updateFields = {};
      if (name !== undefined) updateFields['members.$[elem].name'] = player.name;
      if (email !== undefined) updateFields['members.$[elem].email'] = player.email;
      if (phone !== undefined) updateFields['members.$[elem].phone'] = player.phone;
      if (gender !== undefined) updateFields['members.$[elem].gender'] = player.gender;
      if (position !== undefined) updateFields['members.$[elem].position'] = player.position;
      if (jerseyNumber !== undefined) updateFields['members.$[elem].jerseyNumber'] = player.jerseyNumber;
      if (status !== undefined) updateFields['members.$[elem].status'] = player.status;

      if (Object.keys(updateFields).length > 0) {
        await Team.updateMany(
          { _id: { $in: player.teams } },
          { $set: updateFields },
          { arrayFilters: [{ 'elem.poolPlayerId': player._id }] }
        );
      }
    }

    res.status(200).json({ success: true, message: 'Player updated', data: player });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ success: false, message: 'Error updating player', error: error.message });
  }
};

/**
 * @desc    Get the logged-in player's own sports profile
 * @route   GET /api/player/me
 * @access  Private (player)
 */
const PLAYER_ME_POPULATE = [
  {
    path: 'teams',
    select: 'name primaryColor sport',
    populate: { path: 'sport', select: 'name slug' },
  },
  {
    path: 'academies',
    select: 'name logo sportsOffered',
    populate: { path: 'sportsOffered', select: 'name slug' },
  },
  { path: 'sports.sport', select: 'name slug' },
];

export const getMyPlayerProfile = async (req, res) => {
  try {
    let player = await Player.findOne({ user: req.user._id })
      .sort({ isActive: -1, updatedAt: -1 })
      .populate(PLAYER_ME_POPULATE);

    if (player && !player.isActive) {
      player.isActive = true;
      player.status = 'active';
      await player.save();
      player = await Player.findById(player._id).populate(PLAYER_ME_POPULATE);
    }

    if (!player) {
      const created = await Player.create({
        user: req.user._id,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Player',
        email: req.user.email,
        phone: req.user.phone || '',
      });
      player = await Player.findById(created._id).populate(PLAYER_ME_POPULATE);
    }
    res.status(200).json({ success: true, data: player });
  } catch (error) {
    console.error('Get my player profile error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
  }
};

/**
 * @desc    Update the logged-in player's own sports profile
 * @route   PUT /api/player/me
 * @access  Private (player)
 */
export const updateMyPlayerProfile = async (req, res) => {
  try {
    let player = await Player.findOne({ user: req.user._id }).sort({ isActive: -1, updatedAt: -1 });

    if (!player) {
      return res.status(404).json({ success: false, message: 'Player profile not found' });
    }

    const { name, phone, dateOfBirth, gender, position, jerseyNumber, photo, sports } = req.body;

    if (name !== undefined) player.name = name.trim();
    if (phone !== undefined) player.phone = phone;
    if (dateOfBirth !== undefined) player.dateOfBirth = dateOfBirth || null;
    if (gender !== undefined) player.gender = gender;
    if (position !== undefined) player.position = position;
    if (jerseyNumber !== undefined) player.jerseyNumber = jerseyNumber != null && jerseyNumber !== '' ? Number(jerseyNumber) : null;
    if (photo !== undefined) player.photo = photo;

    let beforePlayerSports = null;
    let afterPlayerSports = null;
    if (sports !== undefined) {
      beforePlayerSports = Array.isArray(player.sports)
        ? player.sports.map((row) => (typeof row?.toObject === 'function' ? row.toObject() : row))
        : [];
      const cleaned = sanitizePlayerSportsPayload(sports);
      if (cleaned.length > 0) {
        const sportIds = cleaned.map((row) => row.sport);
        const count = await Sport.countDocuments({ _id: { $in: sportIds }, isActive: true });
        if (count !== cleaned.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more sports are invalid or inactive',
          });
        }
      }
      player.sports = cleaned;
      afterPlayerSports = cleaned;
    }

    await player.save();

    if (afterPlayerSports) {
      Promise.resolve()
        .then(async () => {
          await RoleSportAuditTrail.create({
            entityType: 'PLAYER',
            entityId: player._id,
            field: 'sports',
            action: 'SET',
            actorUser: req.user._id,
            actorRole: req.user.role,
            before: beforePlayerSports,
            after: afterPlayerSports,
            metadata: { via: 'updateMyPlayerProfile', user: String(req.user._id) },
          });
        })
        .catch((error) => {
          console.error('Player sports audit log failed:', error.message);
        });
    }

    if (player.teams?.length > 0) {
      const updateFields = {};
      if (name !== undefined) updateFields['members.$[elem].name'] = player.name;
      if (phone !== undefined) updateFields['members.$[elem].phone'] = player.phone;
      if (gender !== undefined) updateFields['members.$[elem].gender'] = player.gender;
      if (position !== undefined) updateFields['members.$[elem].position'] = player.position;
      if (jerseyNumber !== undefined) updateFields['members.$[elem].jerseyNumber'] = player.jerseyNumber;

      if (Object.keys(updateFields).length > 0) {
        await Team.updateMany(
          { _id: { $in: player.teams } },
          { $set: updateFields },
          { arrayFilters: [{ 'elem.poolPlayerId': player._id }] }
        );
      }
    }

    await player.populate('sports.sport', 'name slug');

    res.status(200).json({ success: true, message: 'Profile updated', data: player });
  } catch (error) {
    console.error('Update my player profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
};

const mapResultStatusToUi = (resultStatus, hasResult) => {
  if (resultStatus === 'completed') return 'completed';
  if (resultStatus === 'in_progress') return 'live';
  if (resultStatus === 'cancelled') return 'cancelled';
  if (hasResult) return 'completed';
  return 'upcoming';
};

/**
 * @desc    List matches for the logged-in user from Event.schedule (individual player1/player2)
 * @route   GET /api/player/my-matches
 * @access  Private
 */
export const getMyScheduledMatches = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const sportFilter = req.query.sport ? String(req.query.sport) : '';

    const events = await Event.find({
      $or: [{ 'schedule.matches.player1': userId }, { 'schedule.matches.player2': userId }],
    })
      .populate('sport', 'name')
      .lean();

    const rows = [];
    const uid = userId.toString();

    for (const event of events) {
      if (sportFilter && String(event.sport?._id || event.sport) !== sportFilter) {
        continue;
      }

      const bannerImage = Array.isArray(event.bannerImages) && event.bannerImages.length
        ? event.bannerImages[0]
        : '';

      for (const round of event.schedule || []) {
        for (const m of round.matches || []) {
          const p1 = m.player1 ? String(m.player1) : '';
          const p2 = m.player2 ? String(m.player2) : '';
          if (p1 !== uid && p2 !== uid) {
            continue;
          }

          const hasResult = !!(m.result && (m.result.winner || m.result.score));
          const uiStatus = mapResultStatusToUi(m.result?.status, hasResult);
          if (statusFilter && uiStatus !== statusFilter) {
            continue;
          }

          const isPlayer1 = p1 === uid;
          const opponentId = isPlayer1 ? (m.player2 ? String(m.player2) : '') : p1;

          const winner =
            m.result?.winner != null ? String(m.result.winner) : null;
          let won = null;
          if (uiStatus === 'completed' && winner) {
            won = winner === uid;
          }

          rows.push({
            matchId: String(m._id),
            eventId: String(event._id),
            eventName: event.name || '',
            bannerImage,
            sport: event.sport ? { name: event.sport.name || '', _id: event.sport._id } : { name: sportFilter || 'Sport' },
            round: round.round || '',
            matchNumber: m.matchNumber,
            status: uiStatus,
            participantName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'You',
            participantType: 'player',
            opponentId,
            score: m.result?.score || '',
            won,
            dateTime: m.dateTime || event.startDate,
            venue: m.venue || '',
            location: event.location || null,
          });
        }
      }
    }

    const oppIds = [...new Set(rows.map((r) => r.opponentId).filter(Boolean))];
    const opponents = oppIds.length
      ? await User.find({ _id: { $in: oppIds } }).select('firstName lastName').lean()
      : [];
    const nameById = new Map(
      opponents.map((u) => [String(u._id), `${u.firstName || ''} ${u.lastName || ''}`.trim()]),
    );

    for (const row of rows) {
      const oid = row.opponentId;
      delete row.opponentId;
      row.opponentName = oid ? (nameById.get(oid) || 'TBD') : 'TBD';
    }

    rows.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const slice = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

    return res.status(200).json({
      success: true,
      data: slice,
      pagination: {
        current: page,
        pages,
        total,
      },
    });
  } catch (error) {
    console.error('Get my matches error:', error);
    res.status(500).json({ success: false, message: 'Error fetching matches', error: error.message });
  }
};

/**
 * @desc    Remove player from academy (soft remove from this academy only)
 * @route   DELETE /api/player/:id
 * @access  Private (academyadmin)
 */
export const deletePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || !player.academies.some(a => a.toString() === academy._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    player.academies = player.academies.filter(a => a.toString() !== academy._id.toString());
    await player.save();

    // Remove from academy's teams
    const academyTeams = await Team.find({ academy: academy._id, _id: { $in: player.teams } });
    for (const team of academyTeams) {
      team.members = team.members.filter(m => {
        const pid = m.poolPlayerId?.toString();
        return pid !== player._id.toString();
      });
      await team.save();
      player.teams = player.teams.filter(t => t.toString() !== team._id.toString());
    }
    await player.save();

    res.status(200).json({ success: true, message: 'Player removed from academy' });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ success: false, message: 'Error removing player', error: error.message });
  }
};
