import Event from '../models/Event.js';
import Team from '../models/Team.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import MatchStat from '../models/MatchStat.js';
import EventMatch from '../models/EventMatch.js';
import EventAuditLog from '../models/EventAuditLog.js';
import mongoose from 'mongoose';
import { recalculateEventStandings } from '../utils/standings.js';
import { ingestMatchAnalytics } from '../services/analyticsService.js';
import { emitLiveScoresRefresh } from '../utils/liveScoreBroadcast.js';

// Helper function to check if user can access event (organizer, superadmin, or assigned scorer)
const canAccessEvent = (event, userId, userRole) => {
  // Superadmin can access all events
  if (userRole === 'superadmin') return true;
  
  // Organizer can access their own events
  if (event.organizer && event.organizer.toString() === userId.toString()) return true;
  
  // Scorer can access if assigned to the event
  if (userRole === 'scorer') {
    if (!event.staff || !Array.isArray(event.staff)) return false;
    return event.staff.some(s => {
      if (!s || s.role !== 'scorer') return false;
      // Handle both populated and unpopulated user references
      const staffUserId = s.user?._id ? s.user._id.toString() : (s.user?.toString() || s.user);
      return staffUserId && staffUserId === userId.toString();
    });
  }
  
  return false;
};

const findMatchInEvent = (event, matchId) => {
  for (const round of event.schedule || []) {
    const match = (round.matches || []).find((m) => String(m._id) === String(matchId));
    if (match) return { round, match };
  }
  return { round: null, match: null };
};

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

// @desc    Get event schedule
// @route   GET /api/organizer/events/:eventId/schedule
// @access  Private (Organizer)
export const getEventSchedule = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id firstName lastName'); // Populate staff.user for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this event schedule'
      });
    }

    // Primary source: EventMatch collection. Fallback to legacy embedded schedule if empty.
    const matches = await EventMatch.find({ event: event._id })
      .sort({ round: 1, matchNumber: 1, scheduledAt: 1, createdAt: 1 })
      .lean();

    if (matches.length === 0) {
      const legacy = await Event.findById(req.params.eventId)
        .populate('schedule.matches.team1', 'name logo')
        .populate('schedule.matches.team2', 'name logo')
        .populate('schedule.matches.player1', 'firstName lastName profilePhoto')
        .populate('schedule.matches.player2', 'firstName lastName profilePhoto')
        .populate('schedule.matches.result.winner')
        .select('schedule')
        .lean();

      return res.json({
        success: true,
        data: legacy?.schedule || []
      });
    }

    // Rebuild legacy-shaped response: [{ round, matches: [...] }]
    const roundsMap = new Map();
    for (const m of matches) {
      const roundName = String(m.round || 'Round 1');
      if (!roundsMap.has(roundName)) roundsMap.set(roundName, []);

      const normalizeSide = (side) => {
        if (!side) return { entityType: null, entityId: null };
        return { entityType: side.entityType, entityId: side.entityId };
      };

      const sideA = normalizeSide(m.sideA);
      const sideB = normalizeSide(m.sideB);

      roundsMap.get(roundName).push({
        _id: m._id,
        matchNumber: m.matchNumber,
        team1: sideA.entityType === 'team' ? sideA.entityId : undefined,
        team2: sideB.entityType === 'team' ? sideB.entityId : undefined,
        player1: sideA.entityType === 'player' ? sideA.entityId : undefined,
        player2: sideB.entityType === 'player' ? sideB.entityId : undefined,
        dateTime: m.scheduledAt,
        venue: m.venue,
        result: {
          winner: m.result?.winnerId || null,
          score: m.result?.score || '',
          status: m.status || 'scheduled'
        }
      });
    }

    // Populate team/player names for response (lightweight)
    const teamIds = new Set();
    const userIds = new Set();
    for (const list of roundsMap.values()) {
      for (const mm of list) {
        if (mm.team1) teamIds.add(String(mm.team1));
        if (mm.team2) teamIds.add(String(mm.team2));
        if (mm.player1) userIds.add(String(mm.player1));
        if (mm.player2) userIds.add(String(mm.player2));
      }
    }
    const [teams, users] = await Promise.all([
      teamIds.size
        ? Team.find({ _id: { $in: Array.from(teamIds) } }).select('_id name logo').lean()
        : Promise.resolve([]),
      userIds.size
        ? User.find({ _id: { $in: Array.from(userIds) } }).select('_id firstName lastName profilePhoto').lean()
        : Promise.resolve([]),
    ]);
    const teamById = new Map(teams.map((t) => [String(t._id), t]));
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const data = Array.from(roundsMap.entries()).map(([round, roundMatches]) => ({
      round,
      matches: roundMatches.map((mm) => ({
        ...mm,
        team1: mm.team1 ? teamById.get(String(mm.team1)) || mm.team1 : undefined,
        team2: mm.team2 ? teamById.get(String(mm.team2)) || mm.team2 : undefined,
        player1: mm.player1 ? userById.get(String(mm.player1)) || mm.player1 : undefined,
        player2: mm.player2 ? userById.get(String(mm.player2)) || mm.player2 : undefined,
      }))
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get event schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create a new round
// @route   POST /api/organizer/events/:eventId/schedule/rounds
// @access  Private (Organizer)
export const createRound = async (req, res) => {
  try {
    const { roundName } = req.body;
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id'); // Populate for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Check if round already exists
    const roundExists = event.schedule.some(s => s.round === roundName);
    if (roundExists) {
      return res.status(400).json({
        success: false,
        message: 'Round with this name already exists'
      });
    }

    // Add new round
    event.schedule.push({
      round: roundName,
      matches: []
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Round created successfully',
      data: event.schedule[event.schedule.length - 1]
    });
  } catch (error) {
    console.error('Create round error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create a match
// @route   POST /api/organizer/events/:eventId/schedule/matches
// @access  Private (Organizer)
export const createMatch = async (req, res) => {
  try {
    const { roundName, matchNumber, team1Id, team2Id, player1Id, player2Id, dateTime, venue } = req.body;
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id') // Populate for authorization check
      .populate('registeredTeams.team')
      .populate('registeredPlayers.player');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Find or create round
    let round = event.schedule.find(s => s.round === roundName);
    if (!round) {
      event.schedule.push({
        round: roundName,
        matches: []
      });
      round = event.schedule[event.schedule.length - 1];
    }

    // Validate participants based on game format
    if (event.gameFormat === 'team') {
      if (!team1Id || !team2Id) {
        return res.status(400).json({
          success: false,
          message: 'Both teams are required for team matches'
        });
      }

      // Verify teams are registered
      const team1Reg = event.registeredTeams.find(
        rt => rt.team._id.toString() === team1Id && rt.status !== 'withdrawn'
      );
      const team2Reg = event.registeredTeams.find(
        rt => rt.team._id.toString() === team2Id && rt.status !== 'withdrawn'
      );

      if (!team1Reg || !team2Reg) {
        return res.status(400).json({
          success: false,
          message: 'One or both teams are not registered or have withdrawn'
        });
      }

      if (team1Id === team2Id) {
        return res.status(400).json({
          success: false,
          message: 'A team cannot play against itself'
        });
      }
    } else if (event.gameFormat === 'individual') {
      if (!player1Id || !player2Id) {
        return res.status(400).json({
          success: false,
          message: 'Both players are required for individual matches'
        });
      }

      // Verify players are registered
      const player1Reg = event.registeredPlayers.find(
        rp => rp.player._id.toString() === player1Id && rp.status !== 'withdrawn'
      );
      const player2Reg = event.registeredPlayers.find(
        rp => rp.player._id.toString() === player2Id && rp.status !== 'withdrawn'
      );

      if (!player1Reg || !player2Reg) {
        return res.status(400).json({
          success: false,
          message: 'One or both players are not registered or have withdrawn'
        });
      }

      if (player1Id === player2Id) {
        return res.status(400).json({
          success: false,
          message: 'A player cannot play against themselves'
        });
      }
    } else if (event.gameFormat === 'doubles') {
      // For doubles, we might have teams or pairs
      if (team1Id && team2Id) {
        // Treat as team format
        const team1Reg = event.registeredTeams.find(
          rt => rt.team._id.toString() === team1Id && rt.status !== 'withdrawn'
        );
        const team2Reg = event.registeredTeams.find(
          rt => rt.team._id.toString() === team2Id && rt.status !== 'withdrawn'
        );

        if (!team1Reg || !team2Reg) {
          return res.status(400).json({
            success: false,
            message: 'One or both teams are not registered or have withdrawn'
          });
        }
      } else if (player1Id && player2Id) {
        // Treat as individual pairs (each player represents a pair)
        const player1Reg = event.registeredPlayers.find(
          rp => rp.player._id.toString() === player1Id && rp.status !== 'withdrawn'
        );
        const player2Reg = event.registeredPlayers.find(
          rp => rp.player._id.toString() === player2Id && rp.status !== 'withdrawn'
        );

        if (!player1Reg || !player2Reg) {
          return res.status(400).json({
            success: false,
            message: 'One or both players are not registered or have withdrawn'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Both participants are required for doubles matches'
        });
      }
    }

    // Validate dateTime
    if (!dateTime) {
      return res.status(400).json({
        success: false,
        message: 'Match date and time are required'
      });
    }

    const matchDateTime = new Date(dateTime);
    if (matchDateTime < event.startDate || matchDateTime > event.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Match date must be within the event date range'
      });
    }

    // Generate match number if not provided
    let finalMatchNumber = matchNumber;
    if (!finalMatchNumber) {
      const maxMatchNumber = round.matches.reduce((max, m) => Math.max(max, m.matchNumber || 0), 0);
      finalMatchNumber = maxMatchNumber + 1;
    }

    // Check if match number already exists in this round
    const matchExists = round.matches.some(m => m.matchNumber === finalMatchNumber);
    if (matchExists) {
      return res.status(400).json({
        success: false,
        message: `Match number ${finalMatchNumber} already exists in this round`
      });
    }

    // Create match
    const newMatch = {
      matchNumber: finalMatchNumber,
      dateTime: matchDateTime,
      venue: venue || event.location.venue,
      result: {
        status: 'scheduled'
      }
    };

    if (event.gameFormat === 'team') {
      newMatch.team1 = team1Id;
      newMatch.team2 = team2Id;
    } else {
      newMatch.player1 = player1Id;
      newMatch.player2 = player2Id;
    }

    round.matches.push(newMatch);
    await event.save();

    // Notify participants
    const participants = [];
    if (event.gameFormat === 'team') {
      const team1 = await Team.findById(team1Id).populate('captain');
      const team2 = await Team.findById(team2Id).populate('captain');
      if (team1?.captain) participants.push(team1.captain._id);
      if (team2?.captain) participants.push(team2.captain._id);
    } else {
      if (player1Id) participants.push(player1Id);
      if (player2Id) participants.push(player2Id);
    }

    // Send notifications
    for (const participantId of participants) {
      await Notification.create({
        recipient: participantId,
        sender: req.user._id,
        type: 'reminder',
        title: 'Match Scheduled',
        message: `A match has been scheduled for "${event.name}" on ${matchDateTime.toLocaleString()}.`,
        data: { eventId: event._id }
      });
    }

    // Populate match data for response
    await event.populate('schedule.matches.team1', 'name logo');
    await event.populate('schedule.matches.team2', 'name logo');
    await event.populate('schedule.matches.player1', 'firstName lastName profilePhoto');
    await event.populate('schedule.matches.player2', 'firstName lastName profilePhoto');

    const createdMatch = round.matches[round.matches.length - 1];

    // Persist schedule to dedicated collection (transition: dual-write)
    try {
      const sideA =
        event.gameFormat === 'team'
          ? { entityType: 'team', entityId: team1Id }
          : { entityType: 'player', entityId: player1Id };
      const sideB =
        event.gameFormat === 'team'
          ? { entityType: 'team', entityId: team2Id }
          : { entityType: 'player', entityId: player2Id };

      const matchDoc = await EventMatch.create({
        event: event._id,
        round: roundName,
        matchNumber: matchNumber != null ? Number(matchNumber) : null,
        sideA,
        sideB,
        scheduledAt: matchDateTime,
        venue: venue || event.location?.venue || '',
        status: 'scheduled',
        result: { score: '', winnerType: null, winnerId: null, notes: '' },
        createdBy: req.user._id,
        metadata: { legacyMatchId: createdMatch?._id || null }
      });

      await auditEvent({
        entityType: 'event_match',
        entityId: matchDoc._id,
        action: 'created',
        actor: req.user._id,
        before: null,
        after: matchDoc.toObject(),
        metadata: { eventId: event._id, legacyMatchId: createdMatch?._id || null }
      });
    } catch (e) {
      console.warn('Failed to persist EventMatch (non-blocking):', e?.message || e);
    }

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: createdMatch
    });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update a match
// @route   PUT /api/organizer/events/:eventId/schedule/matches/:matchId
// @access  Private (Organizer)
export const updateMatch = async (req, res) => {
  try {
    const { roundName, matchNumber, team1Id, team2Id, player1Id, player2Id, dateTime, venue, result } = req.body;
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id'); // Populate for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Find round
    const round = event.schedule.find(s => s.round === roundName);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    // Find match by matchNumber in the round
    const matchIndex = round.matches.findIndex(m => m._id.toString() === req.params.matchId);
    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const match = round.matches[matchIndex];

    // Update match fields
    if (matchNumber !== undefined) match.matchNumber = matchNumber;
    if (dateTime !== undefined) {
      const matchDateTime = new Date(dateTime);
      if (matchDateTime < event.startDate || matchDateTime > event.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Match date must be within the event date range'
        });
      }
      match.dateTime = matchDateTime;
    }
    if (venue !== undefined) match.venue = venue;

    // Update participants
    if (event.gameFormat === 'team') {
      if (team1Id !== undefined) match.team1 = team1Id;
      if (team2Id !== undefined) match.team2 = team2Id;
    } else {
      if (player1Id !== undefined) match.player1 = player1Id;
      if (player2Id !== undefined) match.player2 = player2Id;
    }

    // Update result if provided
    if (result) {
      if (result.winner !== undefined) match.result.winner = result.winner;
      if (result.score !== undefined) match.result.score = result.score;
      if (result.status !== undefined) match.result.status = result.status;
    }

    await event.save();

    // Sync to dedicated match schedule collection (non-blocking)
    try {
      const existing = await EventMatch.findOne({
        event: event._id,
        "metadata.legacyMatchId": match._id
      }).lean();

      const sideA =
        event.gameFormat === 'team'
          ? { entityType: 'team', entityId: match.team1 }
          : { entityType: 'player', entityId: match.player1 };
      const sideB =
        event.gameFormat === 'team'
          ? { entityType: 'team', entityId: match.team2 }
          : { entityType: 'player', entityId: match.player2 };

      const updated = await EventMatch.findOneAndUpdate(
        { event: event._id, "metadata.legacyMatchId": match._id },
        {
          $set: {
            round: roundName,
            matchNumber: match.matchNumber != null ? Number(match.matchNumber) : null,
            sideA,
            sideB,
            scheduledAt: match.dateTime || null,
            venue: match.venue || "",
            status: match?.result?.status || "scheduled",
            "result.score": match?.result?.score || "",
            "result.winnerId": match?.result?.winner || null,
            updatedBy: req.user._id,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await auditEvent({
        entityType: 'event_match',
        entityId: updated._id,
        action: existing ? 'updated' : 'created',
        actor: req.user._id,
        before: existing,
        after: updated.toObject(),
        metadata: { eventId: event._id, legacyMatchId: match._id }
      });
    } catch (e) {
      console.warn('Failed to sync EventMatch (non-blocking):', e?.message || e);
    }

    // Populate match data for response
    await event.populate('schedule.matches.team1', 'name logo');
    await event.populate('schedule.matches.team2', 'name logo');
    await event.populate('schedule.matches.player1', 'firstName lastName profilePhoto');
    await event.populate('schedule.matches.player2', 'firstName lastName profilePhoto');

    res.json({
      success: true,
      message: 'Match updated successfully',
      data: round.matches[matchIndex]
    });
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete a match
// @route   DELETE /api/organizer/events/:eventId/schedule/matches/:matchId
// @access  Private (Organizer)
export const deleteMatch = async (req, res) => {
  try {
    const { roundName } = req.query;
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id'); // Populate for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Find round
    const round = event.schedule.find(s => s.round === roundName);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    // Find and remove match
    const matchIndex = round.matches.findIndex(m => m._id.toString() === req.params.matchId);
    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const removed = round.matches[matchIndex];
    round.matches.splice(matchIndex, 1);
    await event.save();

    // Sync delete to dedicated collection (non-blocking)
    try {
      const existing = await EventMatch.findOne({
        event: event._id,
        "metadata.legacyMatchId": removed?._id
      }).lean();
      if (existing?._id) {
        await EventMatch.deleteOne({ _id: existing._id });
        await auditEvent({
          entityType: 'event_match',
          entityId: existing._id,
          action: 'deleted',
          actor: req.user._id,
          before: existing,
          after: null,
          metadata: { eventId: event._id, legacyMatchId: removed?._id || null }
        });
      }
    } catch (e) {
      console.warn('Failed to delete EventMatch (non-blocking):', e?.message || e);
    }

    res.json({
      success: true,
      message: 'Match deleted successfully'
    });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update match result (score, winner, status)
// @route   PUT /api/organizer/events/:eventId/schedule/matches/:matchId/result
// @access  Private (Organizer)
export const updateMatchResult = async (req, res) => {
  try {
    const { roundName, score, winnerId, status } = req.body;
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id'); // Populate for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Find round
    const round = event.schedule.find(s => s.round === roundName);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    // Find match
    const matchIndex = round.matches.findIndex(m => m._id.toString() === req.params.matchId);
    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const match = round.matches[matchIndex];

    // Validate winner
    if (winnerId) {
      if (event.gameFormat === 'team') {
        const isValidWinner = 
          match.team1?.toString() === winnerId || 
          match.team1?._id?.toString() === winnerId ||
          match.team2?.toString() === winnerId || 
          match.team2?._id?.toString() === winnerId;
        
        if (!isValidWinner) {
          return res.status(400).json({
            success: false,
            message: 'Winner must be one of the participating teams'
          });
        }
      } else {
        const isValidWinner = 
          match.player1?.toString() === winnerId || 
          match.player1?._id?.toString() === winnerId ||
          match.player2?.toString() === winnerId || 
          match.player2?._id?.toString() === winnerId;
        
        if (!isValidWinner) {
          return res.status(400).json({
            success: false,
            message: 'Winner must be one of the participating players'
          });
        }
      }
    }

    // Update result
    if (score !== undefined) match.result.score = score;
    if (winnerId !== undefined) match.result.winner = winnerId;
    if (status !== undefined) {
      if (!['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid match status'
        });
      }
      match.result.status = status;
    }

    // If status is completed, ensure winner and score are set
    if (match.result.status === 'completed') {
      if (!match.result.winner) {
        return res.status(400).json({
          success: false,
          message: 'Winner must be set when marking match as completed'
        });
      }
      if (!match.result.score) {
        return res.status(400).json({
          success: false,
          message: 'Score must be set when marking match as completed'
        });
      }
    }

    await event.save();

    // Keep standings in sync whenever a match result changes.
    event.standings = recalculateEventStandings(event);
    await event.save();

    // Fire-and-forget analytics ingest — never awaited, never blocks scoring.
    if (match.result.status === 'completed') {
      ingestMatchAnalytics(event, match);
    }

    // Notify participants about result update
    const participants = [];
    if (event.gameFormat === 'team') {
      const team1 = await Team.findById(match.team1).populate('captain');
      const team2 = await Team.findById(match.team2).populate('captain');
      if (team1?.captain) participants.push(team1.captain._id);
      if (team2?.captain) participants.push(team2.captain._id);
    } else {
      if (match.player1) participants.push(match.player1);
      if (match.player2) participants.push(match.player2);
    }

    // Send notifications
    for (const participantId of participants) {
      await Notification.create({
        recipient: participantId,
        sender: req.user._id,
        type: match.result.status === 'completed' ? 'achievement_unlocked' : 'reminder',
        title: match.result.status === 'completed' ? 'Match Result Updated' : 'Match Status Updated',
        message: match.result.status === 'completed' 
          ? `Match result has been updated for "${event.name}". Score: ${match.result.score}`
          : `Match status has been updated to "${match.result.status}" for "${event.name}".`,
        data: { eventId: event._id }
      });
    }

    // Populate match data for response
    await event.populate('schedule.matches.team1', 'name logo');
    await event.populate('schedule.matches.team2', 'name logo');
    await event.populate('schedule.matches.player1', 'firstName lastName profilePhoto');
    await event.populate('schedule.matches.player2', 'firstName lastName profilePhoto');
    await event.populate('schedule.matches.result.winner');

    emitLiveScoresRefresh({
      eventId: String(event._id),
      matchId: String(match._id),
      kind: 'match_result',
    });

    res.json({
      success: true,
      message: 'Match result updated successfully',
      data: round.matches[matchIndex]
    });
  } catch (error) {
    console.error('Update match result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event standings
// @route   GET /api/organizer/events/:eventId/standings
// @access  Private (Organizer/Assigned Scorer/Superadmin)
export const getEventStandings = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('staff.user', '_id');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view standings for this event'
      });
    }

    if (!Array.isArray(event.standings) || event.standings.length === 0) {
      event.standings = recalculateEventStandings(event);
      await event.save();
    }

    res.json({
      success: true,
      data: event.standings || []
    });
  } catch (error) {
    console.error('Get event standings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Upsert structured match statistics
// @route   PUT /api/organizer/events/:eventId/schedule/matches/:matchId/stats
// @access  Private (Organizer/Assigned Scorer/Superadmin)
export const upsertMatchStats = async (req, res) => {
  try {
    const { roundName, participant, teamTotals = {}, playerStats = [], timeline = [] } = req.body;
    const { eventId, matchId } = req.params;

    const event = await Event.findById(eventId).populate('staff.user', '_id');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update match stats for this event'
      });
    }

    const { round, match } = findMatchInEvent(event, matchId);
    if (!match || (roundName && round?.round !== roundName)) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!participant?.type || !participant?.refId) {
      return res.status(400).json({
        success: false,
        message: 'participant.type and participant.refId are required'
      });
    }

    const normalizedParticipant = {
      type: participant.type,
      refId: participant.refId,
      name: participant.name || ''
    };

    const statDoc = await MatchStat.findOneAndUpdate(
      {
        event: eventId,
        matchId,
        'participant.refId': participant.refId
      },
      {
        $set: {
          participant: normalizedParticipant,
          teamTotals,
          playerStats,
          timeline,
          lastUpdatedBy: req.user._id
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    emitLiveScoresRefresh({
      eventId: String(eventId),
      matchId: String(matchId),
      kind: 'match_stats',
    });

    res.json({
      success: true,
      message: 'Match stats saved successfully',
      data: statDoc
    });
  } catch (error) {
    console.error('Upsert match stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get structured match statistics
// @route   GET /api/organizer/events/:eventId/schedule/matches/:matchId/stats
// @access  Private (Organizer/Assigned Scorer/Superadmin)
export const getMatchStats = async (req, res) => {
  try {
    const { eventId, matchId } = req.params;
    const event = await Event.findById(eventId).populate('staff.user', '_id');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view match stats for this event'
      });
    }

    const { match } = findMatchInEvent(event, matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    const stats = await MatchStat.find({ event: eventId, matchId })
      .populate('playerStats.player', 'firstName lastName profilePhoto')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete a round
// @route   DELETE /api/organizer/events/:eventId/schedule/rounds/:roundName
// @access  Private (Organizer)
export const deleteRound = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id'); // Populate for authorization check

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this event schedule'
      });
    }

    // Find and remove round
    const roundIndex = event.schedule.findIndex(s => s.round === req.params.roundName);
    if (roundIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    event.schedule.splice(roundIndex, 1);
    await event.save();

    res.json({
      success: true,
      message: 'Round deleted successfully'
    });
  } catch (error) {
    console.error('Delete round error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update match result/score
// @route   PUT /api/organizer/events/:eventId/schedule/matches/:matchId/result
// @access  Private (Organizer)
// export const updateMatchResult = async (req, res) => {
//   try {
//     const { roundName, score, winnerId, status } = req.body;
//     const event = await Event.findById(req.params.eventId)
      // .populate('staff.user', '_id'); // Populate for authorization check

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: 'Event not found'
//       });
//     }

//     // Check authorization
//     if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to modify this event schedule'
//       });
//     }

//     // Find round
//     const round = event.schedule.find(s => s.round === roundName);
//     if (!round) {
//       return res.status(404).json({
//         success: false,
//         message: 'Round not found'
//       });
//     }

//     // Find match
//     const matchIndex = round.matches.findIndex(m => m._id.toString() === req.params.matchId);
//     if (matchIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: 'Match not found'
//       });
//     }

//     const match = round.matches[matchIndex];

//     // Validate winner if provided
//     if (winnerId) {
//       if (event.gameFormat === 'team') {
//         // Verify winner is one of the teams in the match
//         const team1Id = match.team1?._id?.toString() || match.team1?.toString();
//         const team2Id = match.team2?._id?.toString() || match.team2?.toString();
        
//         if (winnerId !== team1Id && winnerId !== team2Id) {
//           return res.status(400).json({
//             success: false,
//             message: 'Winner must be one of the teams in this match'
//           });
//         }
//       } else {
//         // Verify winner is one of the players in the match
//         const player1Id = match.player1?._id?.toString() || match.player1?.toString();
//         const player2Id = match.player2?._id?.toString() || match.player2?.toString();
        
//         if (winnerId !== player1Id && winnerId !== player2Id) {
//           return res.status(400).json({
//             success: false,
//             message: 'Winner must be one of the players in this match'
//           });
//         }
//       }
//     }

//     // Update match result
//     if (score !== undefined) match.result.score = score;
//     if (winnerId !== undefined) match.result.winner = winnerId;
//     if (status !== undefined) {
//       match.result.status = status;
      
//       // If marking as completed, ensure score and winner are set
//       if (status === 'completed') {
//         if (!match.result.score) {
//           return res.status(400).json({
//             success: false,
//             message: 'Score is required when marking match as completed'
//           });
//         }
//         if (!match.result.winner) {
//           return res.status(400).json({
//             success: false,
//             message: 'Winner must be selected when marking match as completed'
//           });
//         }
//       }
//     }

//     await event.save();

//     // Notify participants about match result
//     const participants = [];
//     if (event.gameFormat === 'team') {
//       const team1 = await Team.findById(match.team1).populate('captain');
//       const team2 = await Team.findById(match.team2).populate('captain');
//       if (team1?.captain) participants.push(team1.captain._id);
//       if (team2?.captain) participants.push(team2.captain._id);
//     } else {
//       if (match.player1) participants.push(match.player1);
//       if (match.player2) participants.push(match.player2);
//     }

//     // Send notifications
//     for (const participantId of participants) {
//       await Notification.create({
//         recipient: participantId,
//         sender: req.user._id,
//         type: status === 'completed' ? 'achievement_unlocked' : 'reminder',
//         title: status === 'completed' ? 'Match Completed' : 'Match Updated',
//         message: status === 'completed'
//           ? `Match result for "${event.name}" has been updated. Score: ${match.result.score}`
//           : `Match details for "${event.name}" have been updated.`,
//         data: { eventId: event._id }
//       });
//     }

//     // Populate match data for response
//     await event.populate('schedule.matches.team1', 'name logo');
//     await event.populate('schedule.matches.team2', 'name logo');
//     await event.populate('schedule.matches.player1', 'firstName lastName profilePhoto');
//     await event.populate('schedule.matches.player2', 'firstName lastName profilePhoto');
//     await event.populate('schedule.matches.result.winner');

//     res.json({
//       success: true,
//       message: 'Match result updated successfully',
//       data: round.matches[matchIndex]
//     });
//   } catch (error) {
//     console.error('Update match result error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// @desc    Get registered participants for match scheduling
// @route   GET /api/organizer/events/:eventId/participants
// @access  Private (Organizer)
export const getParticipantsForScheduling = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('staff.user', '_id') // Populate for authorization check
      .populate({
        path: 'registeredTeams.team',
        select: 'name logo captain',
        model: 'Team'
      })
      .populate({
        path: 'registeredPlayers.player',
        select: 'firstName lastName profilePhoto email phone',
        model: 'User'
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (!canAccessEvent(event, req.user._id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this event participants'
      });
    }

    // Filter out withdrawn participants and handle unpopulated teams
    const activeTeams = event.registeredTeams
      .filter(rt => {
        // Filter out withdrawn teams
        if (rt.status === 'withdrawn') return false;
        // Filter out teams where team reference is missing or null
        if (!rt.team) {
          console.warn('Team reference is missing for registration:', rt._id);
          return false;
        }
        return true;
      })
      .map(rt => {
        // Handle both populated and unpopulated team references
        const team = rt.team;
        // If team is an ObjectId (not populated), we need to fetch it
        if (team && typeof team === 'object' && team.constructor.name === 'ObjectId') {
          console.warn('Team not populated, skipping:', team.toString());
          return null;
        }
        return {
          _id: team?._id || team?.toString() || rt.team?.toString(),
          name: team?.name || 'Unknown Team',
          logo: team?.logo || '',
          registrationStatus: rt.status
        };
      })
      .filter(team => team !== null); // Remove null entries

    const activePlayers = event.registeredPlayers
      .filter(rp => {
        // Filter out withdrawn players
        if (rp.status === 'withdrawn') return false;
        // Filter out players where player reference is missing or null
        if (!rp.player) {
          console.warn('Player reference is missing for registration:', rp._id);
          return false;
        }
        return true;
      })
      .map(rp => {
        // Handle both populated and unpopulated player references
        const player = rp.player;
        // If player is an ObjectId (not populated), we need to skip it
        if (player && typeof player === 'object' && player.constructor.name === 'ObjectId') {
          console.warn('Player not populated, skipping:', player.toString());
          return null;
        }
        return {
          _id: player?._id || player?.toString() || rp.player?.toString(),
          firstName: player?.firstName || '',
          lastName: player?.lastName || '',
          profilePhoto: player?.profilePhoto || '',
          email: player?.email || '',
          phone: player?.phone || '',
          registrationStatus: rp.status
        };
      })
      .filter(player => player !== null); // Remove null entries

    // Log for debugging
    console.log('Active teams count:', activeTeams.length);
    console.log('Active players count:', activePlayers.length);
    console.log('Total registered teams:', event.registeredTeams.length);
    console.log('Total registered players:', event.registeredPlayers.length);

    res.json({
      success: true,
      data: {
        teams: activeTeams,
        players: activePlayers,
        gameFormat: event.gameFormat
      }
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

