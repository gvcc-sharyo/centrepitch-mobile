import User from '../models/User.js';
import Player from '../models/Player.js';
import Event from '../models/Event.js';
import Team from '../models/Team.js';
import CoachTeam from '../models/CoachTeam.js';
import Sport from '../models/Sport.js';
import UserSport from '../models/UserSport.js';
import Payment from '../models/Payment.js';
import Query from '../models/Query.js';
import Notification from '../models/Notification.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';
import { DUPLICATE_EMAIL_MESSAGE } from '../constants/contactErrors.js';
import { collectEventAnnouncementRecipients } from '../utils/eventAnnouncementRecipients.js';

// @desc    Get organizer dashboard
// @route   GET /api/organizer/dashboard
// @access  Private (Organizer)
export const getDashboard = async (req, res) => {
  try {
    const normalizeRange = (value = '') => String(value || '').trim().toLowerCase();
    const getRangeStartDate = (range) => {
      const now = new Date();
      if (range === '30d') {
        const d = new Date(now);
        d.setDate(now.getDate() - 30);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      if (range === '90d') {
        const d = new Date(now);
        d.setDate(now.getDate() - 90);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      if (range === '365d' || range === '1y' || range === 'year') {
        const d = new Date(now);
        d.setDate(now.getDate() - 365);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      return null;
    };

    const requestedRange = normalizeRange(req.query?.range);
    const validRange = ['30d', '90d', '365d', 'all'].includes(requestedRange)
      ? requestedRange
      : 'all';
    const rangeStartDate = validRange === 'all' ? null : getRangeStartDate(validRange);

    const baseEventQuery = { organizer: req.user._id };
    const rangedEventQuery = rangeStartDate
      ? { ...baseEventQuery, startDate: { $gte: rangeStartDate } }
      : baseEventQuery;

    // Get event counts for selected range
    const [totalEvents, liveEvents, upcomingEvents, completedEvents] = await Promise.all([
      Event.countDocuments(rangedEventQuery),
      Event.countDocuments({ ...rangedEventQuery, status: 'live' }),
      Event.countDocuments({ ...rangedEventQuery, status: 'upcoming' }),
      Event.countDocuments({ ...rangedEventQuery, status: 'completed' })
    ]);

    // Get participants in selected range
    const events = await Event.find(rangedEventQuery).select('_id registeredPlayers registeredTeams');
    const totalParticipants = events.reduce(
      (sum, event) => sum + (event?.registeredPlayers?.length || 0) + (event?.registeredTeams?.length || 0),
      0
    );

    // Revenue in selected range (by paidAt)
    const eventIds = events.map((event) => event._id);
    const paymentMatch = {
      event: { $in: eventIds },
      status: 'completed',
      ...(rangeStartDate ? { paidAt: { $gte: rangeStartDate } } : {})
    };

    const payments = eventIds.length > 0 ? await Payment.find(paymentMatch).select('amount platformFee') : [];
    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
    const platformFees = payments.reduce((sum, payment) => sum + Number(payment?.platformFee || 0), 0);

    const revenueTrend = eventIds.length > 0
      ? await Payment.aggregate([
          { $match: paymentMatch },
          {
            $group: {
              _id: {
                year: { $year: '$paidAt' },
                month: { $month: '$paidAt' }
              },
              revenue: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ])
      : [];

    // Event distribution by sport for selected range
    const eventDistribution = await Event.aggregate([
      { $match: rangedEventQuery },
      {
        $lookup: {
          from: 'sports',
          localField: 'sport',
          foreignField: '_id',
          as: 'sportDetails'
        }
      },
      {
        $unwind: {
          path: '$sportDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            $ifNull: ['$sportDetails.name', '$eventType']
          },
          count: { $sum: 1 },
          sportId: { $first: '$sport' },
          eventType: { $first: '$eventType' }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1,
          sportId: 1,
          eventType: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Recent events for selected range
    const recentEvents = await Event.find(rangedEventQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name registeredPlayers registeredTeams startDate status');

    // Upcoming events (still scoped to selected range when present)
    const nextEvents = await Event.find({
      ...rangedEventQuery,
      status: 'upcoming',
      startDate: { $gte: new Date() }
    })
      .sort({ startDate: 1 })
      .limit(5)
      .select('name startDate location registeredPlayers');

    // Top events by revenue in selected range
    const topEvents = eventIds.length > 0
      ? await Payment.aggregate([
          { $match: paymentMatch },
          {
            $group: {
              _id: '$event',
              revenue: { $sum: '$amount' },
              transactions: { $sum: 1 }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'events',
              localField: '_id',
              foreignField: '_id',
              as: 'event'
            }
          },
          { $unwind: '$event' },
          {
            $project: {
              _id: '$event._id',
              name: '$event.name',
              startDate: '$event.startDate',
              location: '$event.location',
              registeredPlayers: '$event.registeredPlayers',
              registeredTeams: '$event.registeredTeams',
              totalRevenue: '$revenue',
              transactions: 1
            }
          }
        ])
      : [];

    res.json({
      success: true,
      data: {
        selectedRange: validRange,
        rangeStartDate,
        counts: {
          totalEvents,
          liveEvents,
          upcomingEvents,
          completedEvents,
          totalParticipants
        },
        revenue: {
          total: totalRevenue,
          platformFees,
          net: totalRevenue - platformFees
        },
        revenueTrend: revenueTrend.map(r => ({
          period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
          revenue: r.revenue,
          transactions: r.count
        })),
        eventDistribution: eventDistribution.map(e => ({
          type: e.type || e.eventType || 'Other',
          count: e.count,
          eventType: e.eventType
        })),
        recentEvents,
        upcomingEvents: nextEvents,
        topEvents
      }
    });
  } catch (error) {
    console.error('Get organizer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get available players (users with accounts) for team creation
// @route   GET /api/organizer/available-players
// @access  Private (Organizer)
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
    const normalizedTeamSportName = String(teamSportName || '').trim().toLowerCase();
    const shouldExcludeBySportTeam = ['1', 'true', 'yes'].includes(
      String(excludeIfInTeamSport || '').toLowerCase(),
    );
    const query = {
      // role: { $in: ['player', 'coach'] },
      role: { $in: ['player'] },
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
      .select('firstName lastName email phone profilePhoto gender')
      .sort({ firstName: 1 })
      .limit(Math.min(Number(limit) || 200, 500));

    // Optional: Exclude users who are already in any team for the same sport.
    // Academy teams may store linkage via Team.members.poolPlayerId (Player collection).
    const excludedUserIds = new Set();
    const excludedPlayerIds = new Set();
    if (shouldExcludeBySportTeam && normalizedTeamSportName) {
      const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactNameRegex = new RegExp(`^${escapeRegex(teamSportName.trim())}$`, 'i');

      // Resolve Sport id so we can query Team collection efficiently.
      const sportDoc = await Sport.findOne({ name: { $regex: exactNameRegex }, isActive: true })
        .select('_id')
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
        if (poolPlayerIds.size > 0) {
          const poolPlayers = await Player.find({ _id: { $in: Array.from(poolPlayerIds) }, isActive: true })
            .select('_id user')
            .lean();
          for (const p of poolPlayers || []) {
            if (p?.user) excludedUserIds.add(String(p.user));
            excludedPlayerIds.add(String(p._id));
          }
        }
      }

      // Coach teams: members.player are Player ids. Match by sportName and/or UserSport ref (sport field).
      const coachOr = [{ sportName: { $regex: exactNameRegex } }];
      const matchingUserSports = await UserSport.find({
        name: { $regex: exactNameRegex },
        isActive: true,
      })
        .select('_id')
        .lean();
      const userSportIds = (matchingUserSports || []).map((x) => x._id).filter(Boolean);
      if (userSportIds.length > 0) {
        coachOr.push({ sport: { $in: userSportIds } });
      }
      const coachTeams = await CoachTeam.find({
        status: 'active',
        $or: coachOr,
      })
        .select('members.player players.player')
        .lean();
      for (const t of coachTeams || []) {
        for (const m of t?.members || []) {
          if (m?.player) excludedPlayerIds.add(String(m.player));
        }
        for (const p of t?.players || []) {
          if (p?.player) excludedPlayerIds.add(String(p.player));
        }
      }
    }

    const userIds = users.map((u) => u._id);
    const playerProfiles = await Player.find({ user: { $in: userIds }, isActive: true })
      .select('user sports')
      .populate('sports.sport', 'name');
    const byUserId = new Map(
      playerProfiles.map((p) => [String(p.user), p])
    );

    const playerIdByUserId = new Map(
      playerProfiles.map((p) => [String(p.user), String(p._id)]),
    );

    const data = users.map(u => ({
      _id: u._id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unknown',
      email: u.email,
      phone: u.phone,
      profilePhoto: u.profilePhoto,
      gender: u.gender || '',
      sports: byUserId.get(String(u._id))?.sports || [],
      sportCount: Array.isArray(byUserId.get(String(u._id))?.sports) ? byUserId.get(String(u._id)).sports.length : 0,
    })).filter((u) => {
      if (shouldExcludeBySportTeam && normalizedTeamSportName) {
        if (excludedUserIds.has(String(u._id))) return false;
        const pid = playerIdByUserId.get(String(u._id));
        if (pid && excludedPlayerIds.has(String(pid))) return false;
      }
      if (!shouldFilterSports) return true;
      if ((u.sportCount || 0) <= 0) return false;
      if (!normalizedTeamSportName) return true;
      return (u.sports || []).some((entry) => {
        const linkedName = String(entry?.sport?.name || '').trim().toLowerCase();
        const fallbackName = String(entry?.sportName || '').trim().toLowerCase();
        return linkedName === normalizedTeamSportName || fallbackName === normalizedTeamSportName;
      });
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

// @desc    Get teams for organizer (scoped: mine | academy | player | all)
// @route   GET /api/organizer/teams
// @access  Private (Organizer)
export const getOrganizerTeams = async (req, res) => {
  try {
    const { page = 1, limit = 12, sport, search, scope = 'mine' } = req.query;
    const andClauses = [{ isActive: true }];

    if (sport) andClauses.push({ sport });

    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), 'i');
      andClauses.push({
        $or: [{ name: rx }, { description: rx }]
      });
    }

    if (scope === 'mine') {
      // Teams this user created for events/organizer flow — exclude academy-owned rows
      // (same account may be academy admin; those teams share createdBy but have academy set).
      andClauses.push({ createdBy: req.user._id });
      andClauses.push({
        $or: [{ academy: null }, { academy: { $exists: false } }]
      });
    } else if (scope === 'academy') {
      andClauses.push({ academy: { $ne: null } });
    } else if (scope === 'player') {
      const playerUsers = await User.find({ role: 'player', isActive: true }).select('_id').lean();
      const playerIds = playerUsers.map(u => u._id);
      andClauses.push({ createdBy: { $in: playerIds } });
    }
    // scope === 'all' or anything else: no extra ownership filter

    const query = andClauses.length === 1 ? andClauses[0] : { $and: andClauses };

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 12, 50);
    const limitNum = Math.min(Number(limit) || 12, 50);

    const [teams, total] = await Promise.all([
      Team.find(query)
        .populate('captain', 'firstName lastName profilePhoto')
        .populate('academy', 'name')
        .populate('sport', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Team.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: teams,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limitNum) || 1,
        total
      }
    });
  } catch (error) {
    console.error('Get organizer teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get teams created by coaches (for organizer Teams tab)
// @route   GET /api/organizer/coach-teams
// @access  Private (Organizer)
export const getCoachTeams = async (req, res) => {
  try {
    const { page = 1, limit = 12, sport, search } = req.query;
    const query = {};

    if (sport) query.sport = sport;
    if (search && search.trim()) {
      query.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { description: new RegExp(search.trim(), 'i') },
        { sportName: new RegExp(search.trim(), 'i') }
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 12, 50);
    const limitNum = Math.min(Number(limit) || 12, 50);

    const [teams, total] = await Promise.all([
      CoachTeam.find(query)
        .populate('coach', 'firstName lastName email')
        .populate('sport', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CoachTeam.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: teams,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limitNum) || 1,
        total
      }
    });
  } catch (error) {
    console.error('Get coach teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get organizer's events
// @route   GET /api/organizer/events
// @access  Private (Organizer)
export const getMyEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, eventType, search } = req.query;
    const query = { organizer: req.user._id };

    if (status) query.status = status;
    if (eventType) query.eventType = eventType;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Event.countDocuments(query);

    // Add revenue info to each event
    const eventsWithRevenue = await Promise.all(
      events.map(async (event) => {
        const eventPayments = await Payment.find({
          event: event._id,
          status: 'completed'
        });
        const revenue = eventPayments.reduce((sum, p) => sum + p.amount, 0);
        return {
          ...event.toObject(),
          totalRevenue: revenue,
          participantCount: event.registeredPlayers.length + event.registeredTeams.length
        };
      })
    );

    res.json({
      success: true,
      data: eventsWithRevenue,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add team to event
// @route   POST /api/organizer/events/:eventId/teams
// @access  Private (Organizer)
export const addTeamToEvent = async (req, res) => {
  try {
    const { teamId } = req.body;
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if already registered (excluding withdrawn teams)
    const existingRegistration = event.registeredTeams.find(
      t => t.team.toString() === teamId
    );
    
    if (existingRegistration) {
      // If team has withdrawn, allow re-registration
      if (existingRegistration.status === 'withdrawn') {
        // Update the existing registration instead of creating a new one
        existingRegistration.status = 'registered';
        existingRegistration.paymentStatus = event.registrationFee > 0 ? 'pending' : 'completed';
        existingRegistration.registrationDate = new Date();
        
        await event.save();

        // Notify team captain
        await Notification.create({
          recipient: team.captain,
          sender: req.user._id,
          type: 'registration_confirmed',
          title: 'Team Re-registered',
          message: `Your team "${team.name}" has been re-registered for "${event.name}".`,
          data: { eventId: event._id, teamId: team._id }
        });

        return res.json({
          success: true,
          message: 'Team re-registered for event successfully'
        });
      } else {
        // Team is already registered and not withdrawn
        return res.status(400).json({
          success: false,
          message: 'Team already registered for this event'
        });
      }
    }

    event.registeredTeams.push({
      team: teamId,
      registrationDate: new Date(),
      paymentStatus: event.registrationFee > 0 ? 'pending' : 'completed',
      status: 'registered'
    });

    await event.save();

    // Notify team captain
    await Notification.create({
      recipient: team.captain,
      sender: req.user._id,
      type: 'registration_confirmed',
      title: 'Team Registered',
      message: `Your team "${team.name}" has been registered for "${event.name}".`,
      data: { eventId: event._id, teamId: team._id }
    });

    res.json({
      success: true,
      message: 'Team added to event successfully'
    });
  } catch (error) {
    console.error('Add team to event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event participants
// @route   GET /api/organizer/events/:eventId/participants
// @access  Private (Organizer)
export const getEventParticipants = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate({
        path: 'registeredPlayers.player',
        select: 'firstName lastName email phone profilePhoto performanceStats'
      })
      .populate({
        path: 'registeredTeams.team',
        select: 'name logo captain members stats',
        populate: {
          path: 'captain members.player',
          select: 'firstName lastName email phone profilePhoto'
        }
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.json({
      success: true,
      data: {
        players: event.registeredPlayers,
        teams: event.registeredTeams
      }
    });
  } catch (error) {
    console.error('Get event participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update participant status
// @route   PUT /api/organizer/events/:eventId/participants/:participantId
// @access  Private (Organizer)
export const updateParticipantStatus = async (req, res) => {
  try {
    const { status, type } = req.body; // type: 'player' or 'team'
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    let participant;
    let recipientId;

    if (type === 'player') {
      const index = event.registeredPlayers.findIndex(
        p => p.player.toString() === req.params.participantId
      );
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }
      event.registeredPlayers[index].status = status;
      recipientId = event.registeredPlayers[index].player;
    } else {
      const index = event.registeredTeams.findIndex(
        t => t.team.toString() === req.params.participantId
      );
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: 'Team not found'
        });
      }
      event.registeredTeams[index].status = status;
      const team = await Team.findById(req.params.participantId);
      recipientId = team.captain;
    }

    await event.save();

    // Notify participant
    await Notification.create({
      recipient: recipientId,
      sender: req.user._id,
      type: 'announcement',
      title: 'Registration Status Update',
      message: `Your registration status for "${event.name}" has been updated to ${status}.`,
      data: { eventId: event._id }
    });

    res.json({
      success: true,
      message: 'Participant status updated successfully'
    });
  } catch (error) {
    console.error('Update participant status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event revenue details
// @route   GET /api/organizer/events/:eventId/revenue
// @access  Private (Organizer)
export const getEventRevenue = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const payments = await Payment.find({
      event: req.params.eventId,
      status: 'completed'
    }).populate('user', 'firstName lastName email');

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const platformFees = payments.reduce((sum, p) => sum + p.platformFee, 0);

    res.json({
      success: true,
      data: {
        eventId: event._id,
        eventName: event.name,
        totalRevenue,
        platformFees,
        netRevenue: totalRevenue - platformFees,
        totalPayments: payments.length,
        payments: payments.map(p => ({
          _id: p._id,
          user: p.user,
          amount: p.amount,
          paidAt: p.paidAt,
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('Get event revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Contact super admin
// @route   POST /api/organizer/contact-admin
// @access  Private (Organizer)
export const contactSuperAdmin = async (req, res) => {
  try {
    const { subject, message, category, priority, eventId } = req.body;
    console.log('Contact super admin request body:', req.body);

    // Find super admin
    const superAdmin = await User.findOne({ role: 'superadmin' });
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // Create query
    const query = await Query.create({
      from: req.user._id,
      to: superAdmin._id,
      subject,
      message,
      category: category || 'general',
      priority: priority || 'medium',
      event: eventId || null
    });

    // Create notification for super admin
    await Notification.create({
      recipient: superAdmin._id,
      sender: req.user._id,
      type: 'query_received',
      title: 'New Query Received',
      message: `${req.user.firstName} ${req.user.lastName} has sent a query: ${subject}`,
      data: { queryId: query._id }
    });

    res.status(201).json({
      success: true,
      message: 'Query sent successfully',
      data: query
    });
  } catch (error) {
    console.error('Contact super admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get organizer's queries
// @route   GET /api/organizer/queries
// @access  Private (Organizer)
export const getMyQueries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { from: req.user._id };

    if (status) query.status = status;

    const queries = await Query.find(query)
      .populate('to', 'firstName lastName email')
      .populate('event', 'name')
      .populate('responses.from', 'firstName lastName email profilePhoto')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Query.countDocuments(query);

    res.json({
      success: true,
      data: queries,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get my queries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single query
// @route   GET /api/organizer/queries/:id
// @access  Private (Organizer)
export const getMyQuery = async (req, res) => {
  try {
    const query = await Query.findOne({
      _id: req.params.id,
      from: req.user._id
    })
      .populate('to', 'firstName lastName email profilePhoto')
      .populate('event', 'name bannerImages')
      .populate('responses.from', 'firstName lastName email profilePhoto');

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    // Mark as read
    query.isRead = true;
    await query.save();

    res.json({
      success: true,
      data: query
    });
  } catch (error) {
    console.error('Get my query error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get organizer revenue analytics
// @route   GET /api/organizer/revenue-analytics
// @access  Private (Organizer)
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;

    // Get all events by this organizer
    const events = await Event.find({ organizer: req.user._id });
    const eventIds = events.map(e => e._id);

    const matchQuery = {
      event: { $in: eventIds },
      status: 'completed'
    };

    if (startDate) {
      matchQuery.paidAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      matchQuery.paidAt = { ...matchQuery.paidAt, $lte: new Date(endDate) };
    }

    // Total revenue
    const totalStats = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          platformFees: { $sum: '$platformFee' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // Revenue by event
    const revenueByEvent = await Payment.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDetails'
        }
      },
      { $unwind: '$eventDetails' },
      {
        $lookup: {
          from: 'sports',
          localField: 'eventDetails.sport',
          foreignField: '_id',
          as: 'sportDetails'
        }
      },
      {
        $unwind: {
          path: '$sportDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$event',
          eventName: { $first: '$eventDetails.name' },
          eventType: { $first: '$eventDetails.eventType' },
          sportName: { $first: '$sportDetails.name' },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Revenue trend
    let dateGrouping;
    if (groupBy === 'day') {
      dateGrouping = { year: { $year: '$paidAt' }, month: { $month: '$paidAt' }, day: { $dayOfMonth: '$paidAt' } };
    } else if (groupBy === 'week') {
      dateGrouping = { year: { $year: '$paidAt' }, week: { $week: '$paidAt' } };
    } else {
      dateGrouping = { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } };
    }

    const revenueTrend = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: dateGrouping,
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totals: totalStats[0] || { totalRevenue: 0, platformFees: 0, totalTransactions: 0 },
        byEvent: revenueByEvent,
        trend: revenueTrend.map(r => ({
          period: groupBy === 'day'
            ? `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`
            : `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
          revenue: r.revenue,
          transactions: r.transactions
        }))
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create scorer account
// @route   POST /api/organizer/scorers
// @access  Private (Organizer)
export const createScorer = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Validate required fields
    if (!firstName || !lastName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, password'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE
      });
    }

    // Create scorer account
    const scorer = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      role: 'scorer',
      isActive: true,
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false
    });

    // Generate email OTP for first-login verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    scorer.emailOtp = otp;
    scorer.emailOtpExpire = Date.now() + 10 * 60 * 1000;
    scorer.otp = otp; // backward compatibility
    scorer.otpExpire = scorer.emailOtpExpire;
    await scorer.save();

    const emailTemplate = emailTemplates.otpVerification(
      otp,
      [scorer.firstName, scorer.lastName].filter(Boolean).join(' ') || scorer.firstName || 'Scorer'
    );
    
    await sendEmail({
      to: scorer.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });

    res.status(201).json({
      success: true,
      message: 'Scorer account created successfully. Verification OTP has been sent to email.',
      data: {
        _id: scorer._id,
        firstName: scorer.firstName,
        lastName: scorer.lastName,
        email: scorer.email,
        role: scorer.role
      }
    });
  } catch (error) {
    console.error('Create scorer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all scorers
// @route   GET /api/organizer/scorers
// @access  Private (Organizer)
export const getScorers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query = { role: 'scorer' };
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const scorers = await User.find(query)
      .select('firstName lastName email phone isActive createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: scorers,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get scorers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Assign scorer to event
// @route   POST /api/organizer/events/:eventId/assign-scorer
// @access  Private (Organizer)
export const assignScorerToEvent = async (req, res) => {
  try {
    const { scorerId } = req.body;
    const { eventId } = req.params;

    // Check if event exists and belongs to organizer
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign scorers to this event'
      });
    }

    // Check if scorer exists
    const scorer = await User.findById(scorerId);
    if (!scorer || scorer.role !== 'scorer') {
      return res.status(404).json({
        success: false,
        message: 'Scorer not found'
      });
    }

    // Check if already assigned
    const isAssigned = event.staff.some(
      s => s.user && s.user.toString() === scorerId && s.role === 'scorer'
    );

    if (isAssigned) {
      return res.status(400).json({
        success: false,
        message: 'Scorer is already assigned to this event'
      });
    }

    // Add scorer to event staff
    event.staff.push({
      user: scorerId,
      role: 'scorer',
      name: `${scorer.firstName} ${scorer.lastName}`,
      email: scorer.email,
      phone: scorer.phone || null
    });

    await event.save();

    // Send notification to scorer
    await Notification.create({
      recipient: scorerId,
      sender: req.user._id,
      type: 'event_created',
      title: 'Assigned to Event',
      message: `You have been assigned as scorer to "${event.name}"`,
      data: { eventId: event._id }
    });

    res.json({
      success: true,
      message: 'Scorer assigned to event successfully',
      data: event.staff
    });
  } catch (error) {
    console.error('Assign scorer to event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove scorer from event
// @route   DELETE /api/organizer/events/:eventId/scorers/:scorerId
// @access  Private (Organizer)
export const removeScorerFromEvent = async (req, res) => {
  try {
    const { eventId, scorerId } = req.params;

    // Check if event exists and belongs to organizer
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove scorers from this event'
      });
    }

    // Remove scorer from event staff
    event.staff = event.staff.filter(
      s => !(s.user && s.user.toString() === scorerId && s.role === 'scorer')
    );

    await event.save();

    res.json({
      success: true,
      message: 'Scorer removed from event successfully',
      data: event.staff
    });
  } catch (error) {
    console.error('Remove scorer from event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Send announcement to everyone linked to an event (players, teams, staff)
// @route   POST /api/organizer/events/:eventId/announcement
// @access  Private (Organizer / Super Admin)
export const sendEventAnnouncement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, message, priority, includeWithdrawn } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (
      event.organizer.toString() !== req.user._id.toString() &&
      req.user.role !== 'superadmin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send announcements for this event'
      });
    }

    const includeWd = Boolean(includeWithdrawn);
    const { userIds, emailOnlyRecipients } = await collectEventAnnouncementRecipients(
      event,
      { includeWithdrawn: includeWd }
    );

    const organizerId = String(req.user._id);
    const recipientUserIds = userIds.filter((id) => id !== organizerId);

    const notifications = recipientUserIds.map((uid) => ({
      recipients: [uid],
      sender: req.user._id,
      type: 'announcement',
      title: title.trim(),
      message: message.trim(),
      priority: priority || 'medium',
      data: {
        eventId: event._id,
        additionalInfo: {
          eventName: event.name,
          sentByMe: true
        }
      }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    let emailsSent = 0;
    const escapeHtml = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    for (const row of emailOnlyRecipients) {
      const html = `
        <p>Hello ${escapeHtml(row.name)},</p>
        <p><strong>${escapeHtml(event.name)}</strong> — announcement from your organizer:</p>
        <p><strong>${escapeHtml(title.trim())}</strong></p>
        <p>${escapeHtml(message.trim()).replace(/\r\n|\n/g, '<br/>')}</p>
        <p style="color:#666;font-size:12px;">You received this email because you are listed as event staff without a linked Centre Pitch account.</p>
      `;
      const result = await sendEmail({
        to: row.email,
        subject: `[${event.name}] ${title.trim()}`,
        html
      });
      if (result?.success) emailsSent += 1;
    }

    const totalReach = recipientUserIds.length + emailsSent;

    if (totalReach === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No recipients found for this event. Add participants or staff, or include withdrawn registrations.'
      });
    }

    res.json({
      success: true,
      message: `Announcement sent to ${recipientUserIds.length} user(s)${
        emailsSent ? ` and ${emailsSent} email(s) for staff without an account` : ''
      }.`,
      data: {
        notificationsCreated: recipientUserIds.length,
        emailsSent,
        emailOnlyCount: emailOnlyRecipients.length
      }
    });
  } catch (error) {
    console.error('Send event announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
