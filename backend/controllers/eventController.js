import Event from '../models/Event.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Notification from '../models/Notification.js';
import EventPlayerRegistration from '../models/EventPlayerRegistration.js';
import EventPairInvite from '../models/EventPairInvite.js';
import EventAuditLog from '../models/EventAuditLog.js';
import EventTeamRegistration from '../models/EventTeamRegistration.js';
import EventMatch from '../models/EventMatch.js';
import MatchStat from '../models/MatchStat.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';
import Sport from '../models/Sport.js';
import PlatformSettings from '../models/PlatformSettings.js';
import mongoose from 'mongoose';
import SportConfiguration from '../models/SportConfiguration.js';

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

/** Persist category card selection; supports configs without Mongo _id (use code/name as id). */
const normalizeEventCategory = (category) => {
  if (category == null) return null;
  if (typeof category !== 'object' || Array.isArray(category)) return null;
  const id = category.categoryId ?? category.code ?? category.name;
  if (id === undefined || id === null || String(id).trim() === '') return null;
  const toNum = (v) => {
    if (v === '' || v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out = {
    categoryId: String(id).trim(),
    name: category.name != null ? String(category.name) : '',
    code: category.code != null ? String(category.code) : '',
    minAge: toNum(category.minAge),
    maxAge: toNum(category.maxAge),
  };
  if (category.gender != null && String(category.gender).trim() !== '') {
    out.gender = String(category.gender);
  }
  if (category.skillLevel != null && String(category.skillLevel).trim() !== '') {
    out.skillLevel = String(category.skillLevel);
  }
  return out;
};

const auditEvent = async ({ entityType, entityId, action, actor, before = null, after = null, metadata = {}, session = null }) => {
  try {
    await EventAuditLog.create(
      [{ entityType, entityId, action, actor, before, after, metadata }],
      session ? { session } : undefined
    );
  } catch (err) {
    // Audit must never break primary flow
    console.warn('Event audit log write failed:', err?.message || err);
  }
};

const hasNewPlayerRegs = async (eventId) => {
  const count = await EventPlayerRegistration.countDocuments({ event: eventId }).limit(1);
  return count > 0;
};

const isRegistrationOpenForEvent = (event, now = new Date()) => {
  const startRaw = event?.registrationStartDate ? new Date(event.registrationStartDate) : null;
  const endRaw = event?.registrationEndDate ? new Date(event.registrationEndDate) : null;
  if (!startRaw || Number.isNaN(startRaw.getTime()) || !endRaw || Number.isNaN(endRaw.getTime())) return false;

  // Treat selected start/end dates as whole-day boundaries (server local timezone).
  const start = new Date(startRaw);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endRaw);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
};

const countActivePlayerRegs = async (eventId, session = null) => {
  const q = EventPlayerRegistration.countDocuments({ event: eventId, status: { $ne: 'withdrawn' } });
  return session ? q.session(session) : q;
};

const getPublishPricing = async (sportId = null) => {
  const settings = await PlatformSettings.getActiveSettings();
  const matchedSportPricing = (settings?.sportPublishPricing || []).find(
    (item) => item?.isActive !== false && sportId && String(item?.sport) === String(sportId)
  );
  const sourcePricing = matchedSportPricing || settings?.eventPublishPricing || {};
  const baseAmount = Number(sourcePricing?.baseAmount || 0);
  const gstPercent = Number(sourcePricing?.gstPercent || 0);
  const currency = String(sourcePricing?.currency || 'INR').toUpperCase();
  const gstAmount = roundToTwo((baseAmount * gstPercent) / 100);
  const totalAmount = roundToTwo(baseAmount + gstAmount);
  return {
    baseAmount,
    gstPercent,
    gstAmount,
    totalAmount,
    currency,
    sport: matchedSportPricing?.sport || null
  };
};

const deriveLifecycleStatus = ({ isPublished, startDate, endDate, currentStatus }) => {
  if (!isPublished) return 'draft';
  if (currentStatus === 'cancelled' || currentStatus === 'postponed') return currentStatus;
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'upcoming';
  if (now > end) return 'completed';
  if (now >= start && now <= end) return 'live';
  return 'upcoming';
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private (Organizer/Admin)
export const createEvent = async (req, res) => {
  try {
    const {
      name,
      sport: sportId,
      sportConfig,
      gameFormat,
      category,
      eventType,
      description,
      bannerImages,
      qr_code_image,
      startDate,
      endDate,
      registrationStartDate,
      registrationEndDate,
      location,
      maxParticipants,
       maxTeams,
      registrationFee,
      currency,
      contactDetails,
      socialMediaLinks,
      keywords,
      staff,
      isPublished,
      isFeatured,
      registrationSettings,
    } = req.body;
 let sportDetails = null;
    let finalRegistrationSettings = {};

    if (sportId) {
      sportDetails = await Sport.findById(sportId);
      if (!sportDetails) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sport selected'
        });
      }

      const normalizedSportConfig = sportConfig && typeof sportConfig === 'object' ? sportConfig : null;
      const configFormats = normalizedSportConfig?.formats || null;
      const hasPerEventConfig = Boolean(configFormats && typeof configFormats === 'object');

      // Organizer events must validate against organizer's saved sport configuration.
      const roleNorm = String(req.user?.role || '').toLowerCase();
      const isOrganizer = roleNorm === 'organizer';
      const organizerConfig = isOrganizer && req.user?._id
        ? await SportConfiguration.findOne({ createdBy: req.user._id, sport: sportId }).lean()
        : null;

      // Check if the selected format is enabled for this sport
      // (per-event config override OR organizer config OR system sport).
      const formatEnabledViaOrganizerConfig = organizerConfig?.formats
        ? Boolean(organizerConfig.formats?.[gameFormat]?.enabled)
        : false;
      const formatEnabledViaConfig = hasPerEventConfig
        ? Boolean(configFormats?.[gameFormat]?.enabled)
        : false;
      const formatEnabledViaSport = Boolean(sportDetails?.formats?.[gameFormat]?.enabled);

      // If organizer has a saved config, enforce that (optionally overridden by per-event config).
      const formatAllowed = organizerConfig
        ? (formatEnabledViaConfig || formatEnabledViaOrganizerConfig)
        : (formatEnabledViaConfig || formatEnabledViaSport);

      if (!formatAllowed) {
        return res.status(400).json({
          success: false,
          message: `${gameFormat} format is not available for ${sportDetails.name}. Enable it while creating the event.`
        });
      }

      // Build registration settings from sport
      const formatSettings =
        (hasPerEventConfig && configFormats?.[gameFormat] ? configFormats[gameFormat] : null) ||
        (organizerConfig?.formats?.[gameFormat] ? organizerConfig.formats[gameFormat] : null) ||
        sportDetails.formats[gameFormat];
      
      if (gameFormat === 'team') {
        finalRegistrationSettings = {
          maxParticipants: maxParticipants != null ? maxParticipants : null,
          maxTeams: maxTeams != null && maxTeams !== '' ? Number(maxTeams) : null,
          teamSize: {
            min: formatSettings.minPlayersPerTeam || 5,
            max: formatSettings.maxPlayersPerTeam || 15,
            playingCount: formatSettings.playingCount || 11,
            substitutesCount: formatSettings.substitutesCount || 4
          },
          requiresCaptain: (normalizedSportConfig?.teamSettings?.requiresCaptain ?? sportDetails.teamSettings?.requiresCaptain) ?? true,
          requiresViceCaptain: (normalizedSportConfig?.teamSettings?.requiresViceCaptain ?? sportDetails.teamSettings?.requiresViceCaptain) ?? false,
          memberRequiredFields: normalizedSportConfig?.teamSettings?.memberRequiredFields
            || sportDetails.teamSettings?.memberRequiredFields
            || ['name', 'email', 'phone'],
          positions: normalizedSportConfig?.teamSettings?.positions || sportDetails.teamSettings?.positions || [],
          allowIndividualRegistration: registrationSettings?.allowIndividualRegistration || false
        };
      } else if (gameFormat === 'doubles') {
        finalRegistrationSettings = {
          maxParticipants: maxParticipants || null,
          teamSize: {
            min: formatSettings.minPlayers || 2,
            max: formatSettings.maxPlayers || 2,
            playingCount: 2,
            substitutesCount: 0
          }
        };
      } else {
        // Individual
        finalRegistrationSettings = {
          maxParticipants: maxParticipants || null,
          teamSize: {
            min: 1,
            max: 1,
            playingCount: 1,
            substitutesCount: 0
          }
        };
      }

      // Update sport stats
      await Sport.findByIdAndUpdate(sportId, {
        $inc: { 'stats.eventsCount': 1 }
      });
    }

    const categoryData = normalizeEventCategory(category);

    // Publishing access is controlled via subscription/limits.
    // No per-event publish payment is required.

    const event = await Event.create({
      name,
      sport: sportId,
      sportConfig: sportConfig && typeof sportConfig === 'object' ? sportConfig : null,
      gameFormat,
      category: categoryData,
      eventType, // Legacy
      description,
      bannerImages,
      qr_code_image,
      startDate,
      endDate,
      registrationStartDate,
      registrationEndDate,
      location,
     registrationSettings: finalRegistrationSettings,
      maxParticipants, // Legacy
      teamSize: gameFormat === 'team' ? finalRegistrationSettings.teamSize?.playingCount : 1,
      registrationFee,
      currency,
      contactDetails,
      socialMediaLinks,
      keywords,
      staff,
      organizer: req.user._id,
      status: isPublished ? 'upcoming' : 'draft',
      isPublished: isPublished || false,
      isFeatured: isFeatured || false
    });

    await event.populate('sport', 'name slug icon formats');

    // If published, notify relevant users
    if (isPublished) {
      // Notify all players about new event
      const players = await User.find({ role: 'player', isActive: true }).limit(100);;
      const notifications = players.map(player => ({
        recipient: player._id,
        sender: req.user._id,
        type: 'event_created',
        title: 'New Event Created',
        message: `A new event "${event.name}" has been created. Check it out!`,
        data: { eventId: event._id }
      }));

       if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get organizer publish pricing
// @route   GET /api/events/publish-pricing
// @access  Private (Organizer/Admin)
export const getEventPublishPricing = async (req, res) => {
  try {
    const pricing = await getPublishPricing(req.query?.sportId || null);
    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Get event publish pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all events
// @route   GET /api/events
// @access  Public
export const getEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      eventType,
       sport,
      gameFormat,
      city,
      country,
      search,
      startDate,
      endDate,
      minFee,
      maxFee,
      organizer,
      sortBy = 'startDate',
      sortOrder = 'asc',
      timeFilter
    } = req.query;

    const query = { isPublished: true };
    const now = new Date();

    // Time filter: upcoming | live | past (by event dates)
    if (timeFilter === 'upcoming') {
      query.startDate = { $gte: now };
    } else if (timeFilter === 'past') {
      query.endDate = { $lte: now };
    } else if (timeFilter === 'live') {
      query.$and = [
        { startDate: { $lte: now } },
        { endDate: { $gte: now } }
      ];
    }

    // Apply filters
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;
    if (sport) query.sport = sport;
    if (gameFormat) query.gameFormat = gameFormat;
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (country) query['location.country'] = new RegExp(country, 'i');
    if (organizer) query.organizer = organizer;

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { keywords: new RegExp(search, 'i') }
      ];
    }

    if (startDate && !timeFilter) {
      query.startDate = { $gte: new Date(startDate) };
    }

    if (endDate && !timeFilter) {
      query.endDate = { ...query.endDate, $lte: new Date(endDate) };
    }

    if (minFee !== undefined || maxFee !== undefined) {
      query.registrationFee = {};
      if (minFee !== undefined) query.registrationFee.$gte = Number(minFee);
      if (maxFee !== undefined) query.registrationFee.$lte = Number(maxFee);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const events = await Event.find(query).populate('sport', 'name slug icon formats')
      .populate('organizer', 'firstName lastName organizationName profilePhoto')
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: events,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get events where current user is registered (player event tracker / my events)
// @route   GET /api/events/my or GET /api/events/my-registrations
// @access  Private
export const getMyRegisteredEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, track, search, sport } = req.query;
    const userId = req.user._id ? new mongoose.Types.ObjectId(req.user._id.toString()) : req.user._id;
    const now = new Date();

    // User's teams (where user is a member) for team-registration lookup
    const userTeams = await Team.find({ 'members.player': userId }).select('_id').lean();
    const userTeamIds = userTeams.map((t) => t._id);

    // Primary source: separate registration collections (fallback to legacy embedded if none exist).
    const [playerRegs, teamRegs] = await Promise.all([
      EventPlayerRegistration.find({ player: userId, status: { $ne: 'withdrawn' } })
        .select('event status paymentStatus registrationDate paymentCompletedBy partner pairGroupId')
        .populate('partner', 'firstName lastName email profilePhoto')
        .lean(),
      userTeamIds.length > 0
        ? EventTeamRegistration.find({ team: { $in: userTeamIds }, status: { $ne: 'withdrawn' } })
            .select('event team status paymentStatus registrationDate')
            .lean()
        : Promise.resolve([]),
    ]);

    const regByEventId = new Map();
    for (const r of teamRegs || []) {
      const key = String(r.event);
      if (!regByEventId.has(key)) regByEventId.set(key, r);
    }
    for (const r of playerRegs || []) {
      const key = String(r.event);
      if (!regByEventId.has(key)) regByEventId.set(key, r);
    }

    const registeredEventIds = Array.from(regByEventId.keys()).map((id) => new mongoose.Types.ObjectId(id));

    const shouldFallbackToLegacy = registeredEventIds.length === 0;

    const query = { isPublished: true };
    if (!shouldFallbackToLegacy) {
      query._id = { $in: registeredEventIds };
    } else {
    const orConditions = [];
    if (userTeamIds.length > 0) {
      orConditions.push({
        registeredTeams: {
          $elemMatch: {
            team: { $in: userTeamIds },
            status: { $ne: 'withdrawn' }
          }
        }
      });
    }
    orConditions.push({
      registeredPlayers: {
        $elemMatch: {
          player: userId,
          status: { $ne: 'withdrawn' }
        }
      }
    });
      query.$or = orConditions;
    }

    if (status) query.status = status;
    if (sport) query.sport = sport;
    
    // Search by event name or location
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { 'location.city': searchRegex },
          { 'location.venue': searchRegex }
        ]
      });
    }
    // Event Tracker: upcoming (not yet started) or live (started but not ended)
    if (track === '1' || track === 1) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { startDate: { $gte: now } },
          { startDate: { $lte: now }, endDate: { $gte: now } }
        ]
      });
    }

    const events = await Event.find(query)
      .populate('sport', 'name slug')
      .populate('organizer', 'firstName lastName organizationName profilePhoto')
      .sort({ startDate: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await Event.countDocuments(query);

    const enriched = events.map((event) => {
      const reg = regByEventId.get(String(event._id)) || null;
      const startDate = event.startDate ? new Date(event.startDate) : null;
      const diffDays = startDate ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)) : null;
      return {
        ...event,
        myRegistration: reg
          ? {
              status: reg.status,
              paymentStatus: reg.paymentStatus,
              registrationDate: reg.registrationDate,
              paymentCompletedBy: reg.paymentCompletedBy,
              partner: reg.partner || null,
              pairGroupId: reg.pairGroupId || null,
            }
          : null,
        daysUntilEvent: diffDays !== null ? diffDays : undefined
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Get my registered events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all participant user IDs for an event (individual/doubles + team members)
// @route   GET /api/events/:id/participant-ids
// @access  Private
export const getEventParticipantIds = async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await Event.findById(eventId).select('_id').lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const ids = new Set();

    // Preferred: separate collections (covers your new doubles invite flow).
    const [playerRegs, teamRegs] = await Promise.all([
      EventPlayerRegistration.find({ event: eventId, status: { $ne: 'withdrawn' } })
        .select('player partner')
        .lean(),
      EventTeamRegistration.find({ event: eventId, status: { $ne: 'withdrawn' } })
        .select('team')
        .lean(),
    ]);

    for (const r of playerRegs || []) {
      if (r?.player) ids.add(String(r.player));
      if (r?.partner) ids.add(String(r.partner));
    }

    if ((teamRegs || []).length > 0) {
      const teamIds = (teamRegs || []).map((t) => t.team).filter(Boolean);
      const teams = await Team.find({ _id: { $in: teamIds } }).select('members.player').lean();
      for (const t of teams || []) {
        for (const m of t.members || []) {
          const pid = m?.player?._id || m?.player;
          if (pid) ids.add(String(pid));
        }
      }
    }

    // Backward compatible: legacy embedded arrays if they exist
    const legacy = await Event.findById(eventId)
      .select('registeredPlayers registeredTeams')
      .populate('registeredTeams.team', 'members.player')
      .lean();

    for (const rp of legacy?.registeredPlayers || []) {
      if (rp?.status === 'withdrawn') continue;
      if (rp?.player) ids.add(String(rp.player));
      if (rp?.partner) ids.add(String(rp.partner));
    }
    for (const rt of legacy?.registeredTeams || []) {
      if (rt?.status === 'withdrawn') continue;
      const members = rt?.team?.members || [];
      for (const m of members) {
        const pid = m?.player?._id || m?.player;
        if (pid) ids.add(String(pid));
      }
    }

    return res.json({ success: true, data: Array.from(ids) });
  } catch (error) {
    console.error('Get event participant ids error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const event = await Event.findById(req.params.id).populate('sport', 'name slug icon description formats teamSettings categorySettings categories')
      .populate('organizer', 'firstName lastName email phone organizationName profilePhoto')
      .populate('registeredTeams.team', 'name logo members captain')
      .populate('registeredPlayers.player', 'firstName lastName profilePhoto email phone');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment views
    event.views += 1;
    await event.save();

    // If a player is authenticated, attach their registration + pair invite state.
    let myRegistration = null;
    let myPairInviteStatus = null; // 'pending_sent' | 'pending_received' | null
    if (req.user?._id && String(req.user?.role || '').toLowerCase() === 'player') {
      const [playerReg, teamReg] = await Promise.all([
        EventPlayerRegistration.findOne({ event: event._id, player: req.user._id, status: { $ne: 'withdrawn' } })
          .select('status paymentStatus registrationDate partner pairGroupId paymentCompletedBy')
          .lean(),
        EventTeamRegistration.findOne({ event: event._id, registeredBy: req.user._id, status: { $ne: 'withdrawn' } })
          .select('status paymentStatus registrationDate team')
          .lean(),
      ]);
      const reg = playerReg || teamReg;
      if (reg) {
        myRegistration = {
          status: reg.status,
          paymentStatus: reg.paymentStatus,
          registrationDate: reg.registrationDate,
          ...(playerReg
            ? { paymentCompletedBy: reg.paymentCompletedBy }
            : {}),
        };
      }

      if (!myRegistration && event.gameFormat === 'doubles') {
        const pendingInvite = await EventPairInvite.findOne({
          event: event._id,
          status: 'pending',
          $or: [{ inviter: req.user._id }, { partner: req.user._id }],
        }).select('inviter partner').lean();
        if (pendingInvite) {
          myPairInviteStatus =
            String(pendingInvite.inviter) === String(req.user._id) ? 'pending_sent' : 'pending_received';
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...event.toObject(),
        myRegistration,
        myPairInviteStatus,
      }
    });
  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Organizer/Admin)
export const updateEvent = async (req, res) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }

    const wasRescheduled = req.body.startDate &&
      new Date(req.body.startDate).getTime() !== new Date(event.startDate).getTime();

    // Handle registrationSettings update, especially maxTeams
    const updateData = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      updateData.category = normalizeEventCategory(req.body.category);
    }
    // Publishing access is controlled via subscription/limits.
    // No per-event publish payment is required.
    
    // If maxTeams is being updated and gameFormat is team, update registrationSettings
    if (req.body.maxTeams !== undefined && (event.gameFormat === 'team' || req.body.gameFormat === 'team')) {
      if (!updateData.registrationSettings) {
        updateData.registrationSettings = event.registrationSettings || {};
      }
      // Convert maxTeams to number or null
      updateData.registrationSettings.maxTeams = req.body.maxTeams != null && req.body.maxTeams !== '' 
        ? Number(req.body.maxTeams) 
        : null;
    }
    
    // If maxParticipants is being updated, update registrationSettings
    if (req.body.maxParticipants !== undefined) {
      if (!updateData.registrationSettings) {
        updateData.registrationSettings = event.registrationSettings || {};
      }
      updateData.registrationSettings.maxParticipants = req.body.maxParticipants != null && req.body.maxParticipants !== '' 
        ? Number(req.body.maxParticipants) 
        : null;
    }
    if (req.body.status === undefined) {
      const nextIsPublished = req.body.isPublished !== undefined ? !!req.body.isPublished : !!event.isPublished;
      const nextStartDate = req.body.startDate || event.startDate;
      const nextEndDate = req.body.endDate || event.endDate;
      updateData.status = deriveLifecycleStatus({
        isPublished: nextIsPublished,
        startDate: nextStartDate,
        endDate: nextEndDate,
        currentStatus: event.status
      });
    }

    event = await Event.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Notify registered participants if event was rescheduled
    if (wasRescheduled) {
      const participants = [
        ...event.registeredPlayers.map(p => p.player),
        ...event.registeredTeams.map(t => t.team)
      ];

      // Create notifications
      const notifications = [];
      for (const participant of event.registeredPlayers) {
        notifications.push({
          recipient: participant.player,
          sender: req.user._id,
          type: 'event_rescheduled',
          title: 'Event Rescheduled',
          message: `The event "${event.name}" has been rescheduled.`,
          data: { eventId: event._id }
        });

        // Send email
        const user = await User.findById(participant.player);
        if (user) {
          const emailTemplate = emailTemplates.eventNotification(
            user.firstName,
            event.name,
            `The event has been rescheduled to ${new Date(event.startDate).toLocaleDateString()}.`,
            'rescheduled'
          );
          await sendEmail({
            to: user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html
          });
        }
      }

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Organizer/Admin)
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }

    // Notify registered participants
    const notifications = event.registeredPlayers.map(p => ({
      recipient: p.player,
      sender: req.user._id,
      type: 'event_cancelled',
      title: 'Event Cancelled',
      message: `The event "${event.name}" has been cancelled.`,
      data: { eventId: event._id }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);

      // Send cancellation email to each registered player
      for (const participant of event.registeredPlayers) {
        try {
          const user = await User.findById(participant.player);
          if (user?.email) {
            const template = emailTemplates.eventNotification(
              user.firstName || 'Player',
              event.name,
              `The event "${event.name}" has been cancelled. We apologise for any inconvenience caused.`,
              'cancelled'
            );
            await sendEmail({ to: user.email, subject: template.subject, html: template.html });
          }
        } catch (err) {
          console.error('Failed to send event cancellation email:', err);
        }
      }
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Register player for event
// @route   POST /api/events/:id/register
// @access  Private
export const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Team registrations must go through /teams endpoints.
    if (event.gameFormat === 'team') {
      return res.status(400).json({
        success: false,
        message: 'This is a team-format event. Please register a team to join.'
      });
    }

    // Check if registration is open
    const now = new Date();
    if (!isRegistrationOpenForEvent(event, now)) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this event'
      });
    }

    const myId = req.user._id.toString();

    const feeStatus = event.registrationFee > 0 ? 'registered' : 'confirmed';
    const payStatus = event.registrationFee > 0 ? 'pending' : 'completed';

    const legacyFind = (playerId) =>
      (event.registeredPlayers || []).find((p) => String(p.player) === String(playerId)) || null;

    const [existingNew, legacyExisting] = await Promise.all([
      EventPlayerRegistration.findOne({ event: event._id, player: req.user._id }).lean(),
      Promise.resolve(legacyFind(myId)),
    ]);
    const existing = existingNew || legacyExisting;

    if (existing && existing.status !== 'withdrawn') {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }

    // Capacity check: use the larger of legacy vs new collections to avoid overbooking during transition.
    const legacyActiveCount = (event.registeredPlayers || []).filter((p) => p.status !== 'withdrawn').length;
    const newActiveCount = await countActivePlayerRegs(event._id);
    const activeCount = Math.max(legacyActiveCount, newActiveCount);

    const maxParticipants = event.maxParticipants || event.registrationSettings?.maxParticipants || null;
    const capacityNeeded = event.gameFormat === 'doubles' ? 2 : 1;
    if (maxParticipants && activeCount + capacityNeeded > maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event registration is full' });
    }

    const session = await mongoose.startSession();
    let didWrite = false;
    try {
      await session.withTransaction(async () => {
        if (event.gameFormat === 'doubles') {
          const partnerIdFromBody = req.body?.partnerId || req.body?.partner;
          const partnerId = partnerIdFromBody ? String(partnerIdFromBody) : null;
          if (!partnerId) {
            throw new Error('Partner is required for doubles registration');
          }
          if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            throw new Error('Invalid partner id');
          }
          if (partnerId === myId) {
            throw new Error('Partner cannot be yourself');
          }

          const partnerUser = await User.findById(partnerId).select('_id firstName lastName email').session(session);
          if (!partnerUser) {
            const err = new Error('Partner not found');
            err.statusCode = 404;
            throw err;
          }

          const [partnerNew, partnerLegacy] = await Promise.all([
            EventPlayerRegistration.findOne({ event: event._id, player: partnerUser._id }).session(session).lean(),
            Promise.resolve(legacyFind(partnerUser._id)),
          ]);
          const partnerExisting = partnerNew || partnerLegacy;
          if (partnerExisting && partnerExisting.status !== 'withdrawn') {
            throw new Error('Selected partner is already registered for this event');
          }

          const pairGroupId = new mongoose.Types.ObjectId();

          const beforeMe = existingNew || null;
          const beforePartner = partnerNew || null;

          const upsertMe = await EventPlayerRegistration.findOneAndUpdate(
            { event: event._id, player: req.user._id },
            {
              $set: {
                partner: partnerUser._id,
                pairGroupId,
                registrationDate: new Date(),
                paymentStatus: payStatus,
                status: feeStatus,
                createdBy: req.user._id,
                withdrawnAt: null,
                paymentCompletedBy: null,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, session }
          );
          const upsertPartner = await EventPlayerRegistration.findOneAndUpdate(
            { event: event._id, player: partnerUser._id },
            {
              $set: {
                partner: req.user._id,
                pairGroupId,
                registrationDate: new Date(),
                paymentStatus: payStatus,
                status: feeStatus,
                createdBy: req.user._id,
                withdrawnAt: null,
                paymentCompletedBy: null,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, session }
          );

          await auditEvent({
            entityType: 'event_player_registration',
            entityId: upsertMe._id,
            action: beforeMe ? 're_registered' : 'created',
            actor: req.user._id,
            before: beforeMe,
            after: upsertMe.toObject(),
            metadata: { eventId: event._id, gameFormat: 'doubles' },
            session,
          });
          await auditEvent({
            entityType: 'event_player_registration',
            entityId: upsertPartner._id,
            action: beforePartner ? 're_registered' : 'created',
            actor: req.user._id,
            before: beforePartner,
            after: upsertPartner.toObject(),
            metadata: { eventId: event._id, gameFormat: 'doubles' },
            session,
          });

          // Legacy mirror (best-effort during transition)
          const ensureLegacyRow = (playerId, partnerIdValue) => {
            const row = legacyFind(playerId);
            if (row) {
              row.partner = partnerIdValue || null;
              row.registrationDate = new Date();
              row.paymentStatus = payStatus;
              row.status = feeStatus;
            } else {
              event.registeredPlayers.push({
                player: playerId,
                partner: partnerIdValue || null,
                registrationDate: new Date(),
                paymentStatus: payStatus,
                status: feeStatus,
              });
            }
          };
          ensureLegacyRow(req.user._id, partnerUser._id);
          ensureLegacyRow(partnerUser._id, req.user._id);
          await event.save({ session });
        } else {
          const before = existingNew || null;
          const reg = await EventPlayerRegistration.findOneAndUpdate(
            { event: event._id, player: req.user._id },
            {
              $set: {
                partner: null,
                pairGroupId: null,
                registrationDate: new Date(),
                paymentStatus: payStatus,
                status: feeStatus,
                createdBy: req.user._id,
                withdrawnAt: null,
                paymentCompletedBy: null,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true, session }
          );

          await auditEvent({
            entityType: 'event_player_registration',
            entityId: reg._id,
            action: before ? 're_registered' : 'created',
            actor: req.user._id,
            before,
            after: reg.toObject(),
            metadata: { eventId: event._id, gameFormat: 'individual' },
            session,
          });

          const legacyRow = legacyFind(req.user._id);
          if (legacyRow) {
            legacyRow.partner = null;
            legacyRow.registrationDate = new Date();
            legacyRow.paymentStatus = payStatus;
            legacyRow.status = feeStatus;
          } else {
    event.registeredPlayers.push({
      player: req.user._id,
      registrationDate: new Date(),
              paymentStatus: payStatus,
              status: feeStatus,
            });
          }
          await event.save({ session });
        }

        didWrite = true;
      });
    } finally {
      session.endSession();
    }

    if (!didWrite) {
      return res.status(500).json({ success: false, message: 'Registration failed' });
    }

    // Create notification for organizer
    await Notification.create({
      recipient: event.organizer,
      sender: req.user._id,
      type: 'registration_confirmed',
      title: 'New Registration',
      message: `${req.user.firstName} ${req.user.lastName} has registered for "${event.name}".`,
      data: { eventId: event._id }
    });

    // Create notification for player
    await Notification.create({
      recipient: req.user._id,
      sender: event.organizer,
      type: 'registration_confirmed',
      title: 'Registration Successful',
      message: `You have successfully registered for "${event.name}".`,
      data: { eventId: event._id }
    });

    // Send registration confirmation email
    try {
      const start = event.startDate ? new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBC';
      const end = event.endDate ? new Date(event.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      const dateStr = end && start !== end ? `${start} – ${end}` : start;
      const venue = event.location?.venue || 'TBC';
      const locationParts = [event.location?.address, event.location?.city, event.location?.state, event.location?.country].filter(Boolean);
      const locationStr = locationParts.length ? locationParts.join(', ') : 'TBC';
      const template = emailTemplates.eventRegistration(
        req.user.firstName || req.user.email?.split('@')[0] || 'Player',
        event.name,
        { date: dateStr, venue, location: locationStr }
      );
      await sendEmail({ to: req.user.email, subject: template.subject, html: template.html });
    } catch (err) {
      console.error('Failed to send event registration email:', err);
    }

    res.json({
      success: true,
      message: 'Successfully registered for the event',
      data: { requiresPayment: event.registrationFee > 0 }
    });
  } catch (error) {
    console.error('Register for event error:', error);
    if (String(error?.message || '').includes('Partner is required for doubles registration')) {
      return res.status(400).json({ success: false, message: 'Partner is required for doubles registration' });
    }
    if (String(error?.message || '').includes('Invalid partner id')) {
      return res.status(400).json({ success: false, message: 'Invalid partner id' });
    }
    if (String(error?.message || '').includes('Partner cannot be yourself')) {
      return res.status(400).json({ success: false, message: 'Partner cannot be yourself' });
    }
    if (String(error?.message || '').includes('Selected partner is already registered')) {
      return res.status(400).json({ success: false, message: 'Selected partner is already registered for this event' });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Request a doubles pair invite for an event
// @route   POST /api/events/:id/pair-invites
// @access  Private
export const requestPairInvite = async (req, res) => {
  try {
    if (String(req.user?.role || '').toLowerCase() !== 'player') {
      return res.status(403).json({ success: false, message: 'Only players can send pair invites' });
    }
    const event = await Event.findById(req.params.id).select('_id name gameFormat registrationStartDate registrationEndDate maxParticipants registeredPlayers registrationFee currency organizer');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (event.gameFormat !== 'doubles') {
      return res.status(400).json({ success: false, message: 'Pair invites are only available for doubles events' });
    }

    const now = new Date();
    if (!isRegistrationOpenForEvent(event, now)) {
      return res.status(400).json({ success: false, message: 'Registration is not open for this event' });
    }

    const partnerId = req.body?.partnerId || req.body?.partner;
    if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: 'Valid partnerId is required' });
    }
    if (String(partnerId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Partner cannot be yourself' });
    }

    const partner = await User.findById(partnerId).select('_id firstName lastName email isActive role');
    if (!partner || partner.isActive === false || String(partner.role || '').toLowerCase() !== 'player') {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // Prevent inviting if either is already registered (and not withdrawn).
    const myId = String(req.user._id);
    const partnerIdStr = String(partner._id);
    const isActiveReg = (p) => p && p.status !== 'withdrawn';
    const myLegacy = (event.registeredPlayers || []).find((p) => String(p.player) === myId);
    const partnerLegacy = (event.registeredPlayers || []).find((p) => String(p.player) === partnerIdStr);
    const [myNew, partnerNew] = await Promise.all([
      EventPlayerRegistration.findOne({ event: event._id, player: req.user._id }).lean(),
      EventPlayerRegistration.findOne({ event: event._id, player: partner._id }).lean(),
    ]);
    if ((myNew && isActiveReg(myNew)) || (myLegacy && isActiveReg(myLegacy))) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }
    if ((partnerNew && isActiveReg(partnerNew)) || (partnerLegacy && isActiveReg(partnerLegacy))) {
      return res.status(400).json({ success: false, message: 'Selected partner is already registered for this event' });
    }

    // Check max participants (doubles: 2 players per pair). We’ll enforce capacity at accept time too.
    const legacyActiveCount = (event.registeredPlayers || []).filter((p) => p.status !== 'withdrawn').length;
    const newActiveCount = await countActivePlayerRegs(event._id);
    const activeCount = Math.max(legacyActiveCount, newActiveCount);
    const maxParticipants = event.maxParticipants || null;
    if (maxParticipants && activeCount >= maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event registration is full' });
    }

    // Avoid duplicate pending invites (same inviter->partner for same event).
    const existingInvite = await EventPairInvite.findOne({
      event: event._id,
      inviter: req.user._id,
      partner: partner._id,
      status: 'pending'
    }).select('_id').lean();
    if (existingInvite?._id) {
      return res.status(400).json({ success: false, message: 'Pair invite already sent' });
    }

    const notification = await Notification.create({
      recipient: partner._id,
      sender: req.user._id,
      type: 'event_pair_invite',
      title: 'Doubles Pair Invite',
      message: `${req.user.firstName || 'A player'} invited you to join "${event.name}" as doubles partner.`,
      data: {
        eventId: event._id,
        link: `/player/team-invites`,
        additionalInfo: {
          inviterId: req.user._id
        }
      },
      priority: 'high'
    });

    const invite = await EventPairInvite.create({
      event: event._id,
      inviter: req.user._id,
      partner: partner._id,
      status: 'pending',
      notificationId: notification?._id || null,
      message: notification?.message || '',
      expiresAt: null
    });
    await auditEvent({
      entityType: 'event_pair_invite',
      entityId: invite._id,
      action: 'created',
      actor: req.user._id,
      before: null,
      after: invite.toObject(),
      metadata: { eventId: event._id }
    });

    return res.status(200).json({
      success: true,
      message: 'Pair invite sent successfully'
    });
  } catch (error) {
    console.error('Request pair invite error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Respond to a doubles pair invite notification
// @route   PUT /api/events/:id/pair-invites/:notificationId/respond
// @access  Private
export const respondPairInvite = async (req, res) => {
  try {
    if (String(req.user?.role || '').toLowerCase() !== 'player') {
      return res.status(403).json({ success: false, message: 'Only players can respond to pair invites' });
    }
    const { action } = req.body;
    if (!['accept', 'reject'].includes(String(action))) {
      return res.status(400).json({ success: false, message: 'Action must be accept or reject' });
    }

    const invite = await Notification.findOne({
      _id: req.params.notificationId,
      recipient: req.user._id,
      type: 'event_pair_invite'
    }).populate('sender', 'firstName lastName email').populate('data.eventId', 'name gameFormat registrationStartDate registrationEndDate maxParticipants registeredPlayers registrationFee currency organizer');

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    const event = invite.data?.eventId;
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found for this invite' });
    }
    if (event.gameFormat !== 'doubles') {
      return res.status(400).json({ success: false, message: 'This invite is not for a doubles event' });
    }

    const now = new Date();
    if (!isRegistrationOpenForEvent(event, now)) {
      return res.status(400).json({ success: false, message: 'Registration is not open for this event' });
    }

    const inviterId = invite.sender?._id || invite.data?.additionalInfo?.inviterId;
    if (!inviterId) {
      return res.status(400).json({ success: false, message: 'Invalid invite (missing inviter)' });
    }

    const pairInvite = await EventPairInvite.findOne({
      event: event._id,
      partner: req.user._id,
      inviter: inviterId,
      status: 'pending',
      ...(mongoose.Types.ObjectId.isValid(req.params.notificationId) ? { notificationId: req.params.notificationId } : {})
    }).lean();

    // Mark notification as read either way.
    invite.isRead = true;
    invite.readAt = new Date();
    invite.data = invite.data || {};
    invite.data.additionalInfo = invite.data.additionalInfo || {};
    invite.data.additionalInfo.status = action;
    await invite.save();

    if (action === 'reject') {
      if (pairInvite?._id) {
        const updated = await EventPairInvite.findByIdAndUpdate(
          pairInvite._id,
          { $set: { status: 'rejected', respondedAt: new Date() } },
          { new: true }
        );
        await auditEvent({
          entityType: 'event_pair_invite',
          entityId: pairInvite._id,
          action: 'rejected',
          actor: req.user._id,
          before: pairInvite,
          after: updated?.toObject?.() || updated,
          metadata: { eventId: event._id }
        });
      }
      await Notification.create({
        recipient: inviterId,
        sender: req.user._id,
        type: 'announcement',
        title: 'Doubles Invite Rejected',
        message: `${req.user.firstName || 'Your partner'} rejected your doubles invite for "${event.name}".`,
        data: { eventId: event._id },
        priority: 'medium'
      });
      return res.status(200).json({ success: true, message: 'Invite rejected' });
    }

    // Accept: register both players using dedicated collections
    const eventDoc = await Event.findById(event._id);
    if (!eventDoc) return res.status(404).json({ success: false, message: 'Event not found' });

    const myId = String(req.user._id);
    const inviterIdStr = String(inviterId);
    const activeRow = (p) => p && p.status !== 'withdrawn';
    const legacyMine = (eventDoc.registeredPlayers || []).find((p) => String(p.player) === myId);
    const legacyInviter = (eventDoc.registeredPlayers || []).find((p) => String(p.player) === inviterIdStr);
    const [newMine, newInviter] = await Promise.all([
      EventPlayerRegistration.findOne({ event: eventDoc._id, player: req.user._id }).lean(),
      EventPlayerRegistration.findOne({ event: eventDoc._id, player: inviterId }).lean(),
    ]);
    if ((newMine && activeRow(newMine)) || (legacyMine && activeRow(legacyMine))) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }
    if ((newInviter && activeRow(newInviter)) || (legacyInviter && activeRow(legacyInviter))) {
      return res.status(400).json({ success: false, message: 'Inviter is already registered for this event' });
    }

    const legacyActiveCount = (eventDoc.registeredPlayers || []).filter((p) => p.status !== 'withdrawn').length;
    const newActiveCount = await countActivePlayerRegs(eventDoc._id);
    const activeCount = Math.max(legacyActiveCount, newActiveCount);
    const maxParticipants = eventDoc.maxParticipants || eventDoc.registrationSettings?.maxParticipants || null;
    if (maxParticipants && activeCount + 2 > maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event registration is full' });
    }

    const feeStatus = eventDoc.registrationFee > 0 ? 'registered' : 'confirmed';
    const payStatus = eventDoc.registrationFee > 0 ? 'pending' : 'completed';

    const acceptPair = async (session = null) => {
      const txOpts = session ? { session } : undefined;
      const pairGroupId = new mongoose.Types.ObjectId();

      const regInviter = await EventPlayerRegistration.findOneAndUpdate(
        { event: eventDoc._id, player: inviterId },
        {
          $set: {
            partner: req.user._id,
            pairGroupId,
            registrationDate: new Date(),
            paymentStatus: payStatus,
            status: feeStatus,
            createdBy: inviterId,
            withdrawnAt: null,
            paymentCompletedBy: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, ...(txOpts || {}) }
      );
      const regMe = await EventPlayerRegistration.findOneAndUpdate(
        { event: eventDoc._id, player: req.user._id },
        {
          $set: {
            partner: inviterId,
            pairGroupId,
            registrationDate: new Date(),
            paymentStatus: payStatus,
            status: feeStatus,
            createdBy: req.user._id,
            withdrawnAt: null,
            paymentCompletedBy: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, ...(txOpts || {}) }
      );

      await auditEvent({
        entityType: 'event_player_registration',
        entityId: regInviter._id,
        action: newInviter ? 're_registered' : 'created',
        actor: req.user._id,
        before: newInviter || null,
        after: regInviter.toObject(),
        metadata: { eventId: eventDoc._id, source: 'pair_invite_accept' },
        session,
      });
      await auditEvent({
        entityType: 'event_player_registration',
        entityId: regMe._id,
        action: newMine ? 're_registered' : 'created',
        actor: req.user._id,
        before: newMine || null,
        after: regMe.toObject(),
        metadata: { eventId: eventDoc._id, source: 'pair_invite_accept' },
        session,
      });

      if (pairInvite?._id) {
        const updated = await EventPairInvite.findByIdAndUpdate(
          pairInvite._id,
          { $set: { status: 'accepted', respondedAt: new Date() } },
          { new: true, ...(txOpts || {}) }
        );
        await auditEvent({
          entityType: 'event_pair_invite',
          entityId: pairInvite._id,
          action: 'accepted',
          actor: req.user._id,
          before: pairInvite,
          after: updated?.toObject?.() || updated,
          metadata: { eventId: eventDoc._id },
          session,
        });
      }

      // Legacy mirror (best-effort)
      const legacyEnsure = (playerId, partnerIdValue) => {
        const row = (eventDoc.registeredPlayers || []).find((p) => String(p.player) === String(playerId));
        if (row) {
          row.partner = partnerIdValue;
          row.registrationDate = new Date();
          row.paymentStatus = payStatus;
          row.status = feeStatus;
        } else {
          eventDoc.registeredPlayers.push({
            player: playerId,
            partner: partnerIdValue,
            registrationDate: new Date(),
            paymentStatus: payStatus,
            status: feeStatus
          });
        }
      };
      legacyEnsure(inviterId, req.user._id);
      legacyEnsure(req.user._id, inviterId);
      await eventDoc.save(txOpts || undefined);
    };

    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          await acceptPair(session);
        });
      } catch (err) {
        const msg = String(err?.message || '');
        if (msg.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
          await acceptPair(null);
        } else {
          throw err;
        }
      }
    } finally {
      session.endSession();
    }

    await Notification.create({
      recipient: inviterId,
      sender: req.user._id,
      type: 'registration_confirmed',
      title: 'Doubles Pair Accepted',
      message: `${req.user.firstName || 'Your partner'} accepted your doubles invite for "${eventDoc.name}". You are now registered.`,
      data: { eventId: eventDoc._id },
      priority: 'high'
    });

    await Notification.create({
      recipient: req.user._id,
      sender: inviterId,
      type: 'registration_confirmed',
      title: 'Doubles Registration Confirmed',
      message: `You accepted the doubles invite for "${eventDoc.name}". You are now registered.`,
      data: { eventId: eventDoc._id },
      priority: 'high'
    });

    return res.status(200).json({
      success: true,
      message: 'Invite accepted and registration completed',
      data: { requiresPayment: eventDoc.registrationFee > 0 }
    });
  } catch (error) {
    console.error('Respond pair invite error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Withdraw from event
// @route   POST /api/events/:id/withdraw
// @access  Private
export const withdrawFromEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const existing = await EventPlayerRegistration.findOne({ event: event._id, player: req.user._id });
    const legacyPlayerIndex = (event.registeredPlayers || []).findIndex(
      (p) => String(p.player) === String(req.user._id)
    );

    if (!existing && legacyPlayerIndex === -1) {
      return res.status(400).json({ success: false, message: 'You are not registered for this event' });
    }

    if (
      existing &&
      existing.pairGroupId &&
      existing.paymentStatus === 'completed' &&
      existing.paymentCompletedBy &&
      String(existing.paymentCompletedBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only the player who completed payment can withdraw this doubles registration.',
      });
    }

    if (
      !existing &&
      legacyPlayerIndex !== -1 &&
      event.gameFormat === 'doubles'
    ) {
      const row = event.registeredPlayers[legacyPlayerIndex];
      if (
        row &&
        row.paymentStatus === 'completed' &&
        row.paymentCompletedBy &&
        String(row.paymentCompletedBy) !== String(req.user._id)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Only the player who completed payment can withdraw this doubles registration.',
        });
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();

        if (existing) {
          const before = existing.toObject();
          existing.status = 'withdrawn';
          existing.withdrawnAt = now;
          await existing.save({ session });
          await auditEvent({
            entityType: 'event_player_registration',
            entityId: existing._id,
            action: 'withdrawn',
            actor: req.user._id,
            before,
            after: existing.toObject(),
            metadata: { eventId: event._id },
            session
          });

          // If doubles, withdraw partner row by pairGroupId (if present)
          if (existing.pairGroupId) {
            const partnerReg = await EventPlayerRegistration.findOne({
              event: event._id,
              pairGroupId: existing.pairGroupId,
              player: { $ne: req.user._id }
            }).session(session);
            if (partnerReg && partnerReg.status !== 'withdrawn') {
              const beforePartner = partnerReg.toObject();
              partnerReg.status = 'withdrawn';
              partnerReg.withdrawnAt = now;
              await partnerReg.save({ session });
              await auditEvent({
                entityType: 'event_player_registration',
                entityId: partnerReg._id,
                action: 'withdrawn',
                actor: req.user._id,
                before: beforePartner,
                after: partnerReg.toObject(),
                metadata: { eventId: event._id, cause: 'pair_withdraw' },
                session
              });
            }
          }
        }

        // Legacy mirror
        if (legacyPlayerIndex !== -1) {
          event.registeredPlayers[legacyPlayerIndex].status = 'withdrawn';
          if (event.gameFormat === 'doubles') {
            const myLegacyPartner = event.registeredPlayers[legacyPlayerIndex]?.partner
              ? String(event.registeredPlayers[legacyPlayerIndex].partner)
              : null;
            if (myLegacyPartner) {
              const partnerIndex = (event.registeredPlayers || []).findIndex(
                (p) =>
                  String(p.player) === String(myLegacyPartner) &&
                  String(p.partner || '') === String(req.user._id) &&
                  p.status !== 'withdrawn'
              );
              if (partnerIndex !== -1) {
                event.registeredPlayers[partnerIndex].status = 'withdrawn';
              }
            }
          }
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
      type: 'registration_cancelled',
      title: 'Player Withdrawn',
      message: `${req.user.firstName} ${req.user.lastName} has withdrawn from "${event.name}".`,
      data: { eventId: event._id }
    });

    res.json({
      success: true,
      message: 'Successfully withdrawn from the event'
    });
  } catch (error) {
    console.error('Withdraw from event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get registered players for event
// @route   GET /api/events/:id/players
// @access  Private (Organizer/Admin)
export const getRegisteredPlayers = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select('_id gameFormat registeredPlayers');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const regs = await EventPlayerRegistration.find({ event: event._id })
      .populate('player', 'firstName lastName email phone profilePhoto performanceStats achievements')
      .populate('partner', 'firstName lastName email phone profilePhoto')
      .sort({ registrationDate: -1 })
      .lean();

    const hasNew = regs.length > 0;

    res.json({
      success: true,
      data: hasNew ? regs : (event.registeredPlayers || [])
    });
  } catch (error) {
    console.error('Get registered players error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update player status in event
// @route   PUT /api/events/:id/players/:playerId
// @access  Private (Organizer/Admin)
export const updatePlayerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const playerIndex = event.registeredPlayers.findIndex(
      (player) => player._id.toString() === req.params.playerId.toString()
    );

    console.log(req.params.playerId);

    console.log('Event:', event);
    console.log('Player Index:', playerIndex);

    if (playerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Player not found in event'
      });
    }

    event.registeredPlayers[playerIndex].status = status;
    await event.save();

    // Notify player
    await Notification.create({
      recipient: req.params.playerId,
      sender: req.user._id,
      type: 'announcement',
      title: 'Registration Status Update',
      message: `Your registration status for "${event.name}" has been updated to ${status}.`,
      data: { eventId: event._id }
    });

    res.json({
      success: true,
      message: 'Player status updated successfully'
    });
  } catch (error) {
    console.error('Update player status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add staff to event
// @route   POST /api/events/:id/staff
// @access  Private (Organizer/Admin)
export const addStaffToEvent = async (req, res) => {
  try {
    const { user, role, name, email, phone } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    event.staff.push({ user, role, name, email, phone });
    await event.save();

    res.json({
      success: true,
      message: 'Staff added successfully',
      data: event.staff
    });
  } catch (error) {
    console.error('Add staff to event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Public
export const getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const events = await Event.find({
      isPublished: true,
      status: 'upcoming',
      startDate: { $gte: new Date() }
    })
      .populate('organizer', 'firstName lastName organizationName')
      .sort({ startDate: 1 })
      .limit(Number(limit));

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get featured events
// @route   GET /api/events/featured
// @access  Public
export const getFeaturedEvents = async (req, res) => {
  try {
    const events = await Event.find({
      isPublished: true,
      isFeatured: true,
      status: { $in: ['upcoming', 'live'] }
    })
      .populate('organizer', 'firstName lastName organizationName')
      .sort({ startDate: 1 })
      .limit(6);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get featured events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get live/in-progress events with scores
// @route   GET /api/events/live
// @access  Public
export const getLiveEvents = async (req, res) => {
  try {
    const now = new Date();
    
    // Find events that are currently in progress
    // Either status is 'live' OR current time is between startDate and endDate
    const events = await Event.find({
      isPublished: true,
      $or: [
        { status: 'live' },
        {
          startDate: { $lte: now },
          endDate: { $gte: now }
        }
      ]
    })
      .populate('sport', 'name slug icon')
      .populate('organizer', 'firstName lastName organizationName')
      .sort({ startDate: -1 })
      .limit(10);

    // Process events to extract live matches with scores (primary: EventMatch, fallback: legacy schedule)
    const liveEventsWithMatches = await Promise.all(events.map(async (event) => {
      let liveMatches = [];

      const newMatches = await EventMatch.find({
        event: event._id,
        status: 'in_progress'
      })
        .sort({ scheduledAt: 1, createdAt: 1 })
        .lean();

      if (newMatches.length > 0) {
        const teamIds = new Set();
        const userIds = new Set();
        for (const m of newMatches) {
          if (m.sideA?.entityType === 'team') teamIds.add(String(m.sideA.entityId));
          if (m.sideB?.entityType === 'team') teamIds.add(String(m.sideB.entityId));
          if (m.sideA?.entityType === 'player') userIds.add(String(m.sideA.entityId));
          if (m.sideB?.entityType === 'player') userIds.add(String(m.sideB.entityId));
        }
        const [teams, users] = await Promise.all([
          teamIds.size ? Team.find({ _id: { $in: Array.from(teamIds) } }).select('_id name').lean() : Promise.resolve([]),
          userIds.size ? User.find({ _id: { $in: Array.from(userIds) } }).select('_id firstName lastName').lean() : Promise.resolve([]),
        ]);
        const teamById = new Map(teams.map((t) => [String(t._id), t]));
        const userById = new Map(users.map((u) => [String(u._id), u]));

        liveMatches = newMatches.map((m) => {
          const isTeamA = m.sideA?.entityType === 'team';
          const isTeamB = m.sideB?.entityType === 'team';
          const team1 = isTeamA ? m.sideA?.entityId : null;
          const team2 = isTeamB ? m.sideB?.entityId : null;
          const player1 = m.sideA?.entityType === 'player' ? m.sideA?.entityId : null;
          const player2 = m.sideB?.entityType === 'player' ? m.sideB?.entityId : null;
          const team1Name = team1 ? (teamById.get(String(team1))?.name || 'Team 1') : null;
          const team2Name = team2 ? (teamById.get(String(team2))?.name || 'Team 2') : null;
          const player1Name = player1 ? (() => {
            const u = userById.get(String(player1));
            return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Player 1';
          })() : null;
          const player2Name = player2 ? (() => {
            const u = userById.get(String(player2));
            return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Player 2';
          })() : null;

          return {
            matchId: m._id,
            round: m.round,
            matchNumber: m.matchNumber,
            team1,
            team1Name,
            team2,
            team2Name,
            player1,
            player1Name,
            player2,
            player2Name,
            score: m.result?.score || '',
            status: m.status,
            dateTime: m.scheduledAt,
            venue: m.venue
          };
        });
      } else {
        // Legacy fallback
      if (event.schedule && event.schedule.length > 0) {
        for (const round of event.schedule) {
          if (round.matches && round.matches.length > 0) {
            for (const match of round.matches) {
              if (match.result && match.result.status === 'in_progress') {
                let team1Name = null;
                let team2Name = null;
                let player1Name = null;
                let player2Name = null;

                if (match.team1) {
                  const team1 = await Team.findById(match.team1).select('name');
                  team1Name = team1?.name || 'Team 1';
                }
                if (match.team2) {
                  const team2 = await Team.findById(match.team2).select('name');
                  team2Name = team2?.name || 'Team 2';
                }
                if (match.player1) {
                  const player1 = await User.findById(match.player1).select('firstName lastName');
                  player1Name = player1 ? `${player1.firstName} ${player1.lastName}` : 'Player 1';
                }
                if (match.player2) {
                  const player2 = await User.findById(match.player2).select('firstName lastName');
                  player2Name = player2 ? `${player2.firstName} ${player2.lastName}` : 'Player 2';
                }

                liveMatches.push({
                  matchId: match._id,
                  round: round.round,
                  matchNumber: match.matchNumber,
                  team1: match.team1,
                  team1Name: team1Name,
                  team2: match.team2,
                  team2Name: team2Name,
                  player1: match.player1,
                  player1Name: player1Name,
                  player2: match.player2,
                  player2Name: player2Name,
                  score: match.result.score,
                  status: match.result.status,
                  dateTime: match.dateTime,
                  venue: match.venue
                });
                }
              }
            }
          }
        }
      }

      return {
        _id: event._id,
        name: event.name,
        sport: event.sport,
        gameFormat: event.gameFormat,
        bannerImages: event.bannerImages,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        status: event.status,
        liveMatches: liveMatches,
        hasLiveMatches: liveMatches.length > 0
      };
    }));

    // Filter to only return events with live matches or live status
    const filteredEvents = liveEventsWithMatches.filter(event => event.hasLiveMatches || event.status === 'live');

    res.json({
      success: true,
      data: filteredEvents
    });
  } catch (error) {
    console.error('Get live events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const resolveSideName = async (side) => {
  if (!side?.entityType || !side?.entityId) return 'TBD';
  const id = side.entityId;
  if (side.entityType === 'team') {
    const t = await Team.findById(id).select('name').lean();
    return t?.name || 'Team';
  }
  if (side.entityType === 'player') {
    const u = await User.findById(id).select('firstName lastName').lean();
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Player' : 'Player';
  }
  if (side.entityType === 'pair') {
    return 'Pair';
  }
  return 'Side';
};

// @desc    Public live match detail (score + MatchStat rows) for landing modal
// @route   GET /api/events/live/match/:eventId/:matchId/detail
// @access  Public
export const getPublicLiveMatchDetail = async (req, res) => {
  try {
    const { eventId, matchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const now = new Date();
    const event = await Event.findOne({
      _id: eventId,
      isPublished: true,
      $or: [
        { status: 'live' },
        { startDate: { $lte: now }, endDate: { $gte: now } }
      ]
    })
      .select('name sport startDate endDate status gameFormat schedule')
      .populate('sport', 'name icon slug')
      .populate('schedule.matches.team1', 'name')
      .populate('schedule.matches.team2', 'name')
      .populate('schedule.matches.player1', 'firstName lastName')
      .populate('schedule.matches.player2', 'firstName lastName')
      .lean();

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found or not live' });
    }

    const em = await EventMatch.findOne({
      event: eventId,
      $or: [{ _id: matchId }, { 'metadata.legacyMatchId': matchId }]
    }).lean();

    const statIds = new Set([String(matchId)]);
    if (em?._id) statIds.add(String(em._id));
    if (em?.metadata?.legacyMatchId) statIds.add(String(em.metadata.legacyMatchId));

    const statObjectIds = [...statIds]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const stats = await MatchStat.find({
      event: eventId,
      matchId: { $in: statObjectIds }
    })
      .select('participant teamTotals playerStats timeline updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    let sideALabel = '';
    let sideBLabel = '';
    let score = '';
    let status = '';
    let roundName = '';
    let venue = '';
    let dateTime = null;
    let matchNumber = null;

    const embeddedId = em?.metadata?.legacyMatchId
      ? String(em.metadata.legacyMatchId)
      : String(matchId);

    let embedded = null;
    let embeddedRound = '';
    for (const r of event.schedule || []) {
      const m = (r.matches || []).find((x) => String(x._id) === embeddedId);
      if (m) {
        embedded = m;
        embeddedRound = r.round || '';
        break;
      }
    }

    if (embedded) {
      roundName = embeddedRound;
      matchNumber = embedded.matchNumber;
      score = embedded.result?.score || '';
      status = embedded.result?.status || '';
      venue = embedded.venue || '';
      dateTime = embedded.dateTime || null;
      if (embedded.scheduleSideA?.label) sideALabel = embedded.scheduleSideA.label;
      if (embedded.scheduleSideB?.label) sideBLabel = embedded.scheduleSideB.label;
      if (!sideALabel) {
        if (embedded.team1?.name) sideALabel = embedded.team1.name;
        else if (embedded.player1) {
          const p = embedded.player1;
          sideALabel = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Side A';
        }
      }
      if (!sideBLabel) {
        if (embedded.team2?.name) sideBLabel = embedded.team2.name;
        else if (embedded.player2) {
          const p = embedded.player2;
          sideBLabel = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Side B';
        }
      }
    }

    if (em) {
      roundName = roundName || em.round || '';
      matchNumber = matchNumber ?? em.matchNumber;
      score = score || em.result?.score || '';
      status = status || em.status || '';
      venue = venue || em.venue || '';
      dateTime = dateTime || em.scheduledAt || null;
      if (!sideALabel) sideALabel = await resolveSideName(em.sideA);
      if (!sideBLabel) sideBLabel = await resolveSideName(em.sideB);
    }

    if (!embedded && !em) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    res.json({
      success: true,
      data: {
        event: {
          _id: event._id,
          name: event.name,
          sport: event.sport,
          gameFormat: event.gameFormat
        },
        match: {
          statsMatchId: embeddedId,
          round: roundName,
          matchNumber,
          sideALabel: sideALabel || 'Side A',
          sideBLabel: sideBLabel || 'Side B',
          score,
          status,
          venue,
          dateTime
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get public live match detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get events by organizer
// @route   GET /api/events/organizer/:organizerId
// @access  Public
export const getEventsByOrganizer = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { organizer: req.params.organizerId };

    if (status === 'published') {
      query.isPublished = true;
      query.status = { $ne: 'draft' };
    } else if (status === 'draft') {
      query.isPublished = false;
      query.status = 'draft';
    } else if (status) {
      query.status = status;
    }

    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: events,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get events by organizer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reschedule event
// @route   PUT /api/events/:id/reschedule
// @access  Private (Organizer/Admin)
export const rescheduleEvent = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check ownership
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this event'
      });
    }

    event.startDate = startDate;
    event.endDate = endDate;
    event.rescheduledReason = reason;
    event.status = 'upcoming';
    await event.save();

    // Notify all registered players
    const notifications = event.registeredPlayers.map(p => ({
      recipient: p.player,
      sender: req.user._id,
      type: 'event_rescheduled',
      title: 'Event Rescheduled',
      message: `The event "${event.name}" has been rescheduled to ${new Date(startDate).toLocaleDateString()}. Reason: ${reason}`,
      data: { eventId: event._id }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.json({
      success: true,
      message: 'Event rescheduled successfully',
      data: event
    });
  } catch (error) {
    console.error('Reschedule event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    After paying via organizer static QR, captain/creator submits UTR/note for manual verification
// @route   POST /api/events/:id/team-registrations/submit-payment-reference
// @access  Private
export const submitTeamPaymentReference = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { teamId, utr, note } = req.body || {};
    if (!teamId) {
      return res.status(400).json({ success: false, message: 'teamId is required' });
    }

    const event = await Event.findById(eventId).select('organizer name');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const reg = await EventTeamRegistration.findOne({
      event: eventId,
      team: teamId,
      status: { $ne: 'withdrawn' },
    });

    if (!reg) {
      return res.status(404).json({ success: false, message: 'Team registration not found' });
    }

    const team = await Team.findById(teamId).select('captain createdBy').lean();
    const uid = String(req.user._id);
    const ok =
      (reg.registeredBy && String(reg.registeredBy) === uid) ||
      (team?.captain && String(team.captain) === uid) ||
      (team?.createdBy && String(team.createdBy) === uid);

    if (!ok) {
      return res.status(403).json({
        success: false,
        message:
          'Only the person who registered the team, the captain, or the team creator can submit payment proof',
      });
    }

    reg.metadata = {
      ...(reg.metadata && typeof reg.metadata === 'object' ? reg.metadata : {}),
      offlinePaymentProof: {
        utr: String(utr || '').trim(),
        note: String(note || '').trim(),
        submittedAt: new Date().toISOString(),
        submittedBy: req.user._id,
      },
    };
    await reg.save();

    if (event.organizer) {
      await Notification.create({
        recipient: event.organizer,
        sender: req.user._id,
        type: 'payment_received',
        title: 'Payment reference submitted',
        message: `A team submitted a payment reference for "${event.name}". Review bank statement and mark payment received if it matches.`,
        data: { eventId: event._id, teamId },
      });
    }

    return res.json({
      success: true,
      message:
        'Reference saved. The organizer will verify against their bank statement and mark your payment as received.',
    });
  } catch (error) {
    console.error('submitTeamPaymentReference error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
