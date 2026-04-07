import User from '../models/User.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';

// @desc    Get scorer dashboard
// @route   GET /api/scorer/dashboard
// @access  Private (Scorer)
export const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all events where scorer is assigned
    const events = await Event.find({
      'staff.user': userId,
      'staff.role': 'scorer'
    })
      .populate('sport', 'name slug icon')
      .populate('organizer', 'firstName lastName organizationName')
      .select('name sport organizer status startDate endDate location bannerImages schedule')
      .sort({ startDate: -1 });

    // Count events by status
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => e.status === 'upcoming').length;
    const liveEvents = events.filter(e => e.status === 'live').length;
    const completedEvents = events.filter(e => e.status === 'completed').length;

    // Count total matches
    let totalMatches = 0;
    let completedMatches = 0;
    let upcomingMatches = 0;
    let liveMatches = 0;

    events.forEach(event => {
      if (event.schedule && event.schedule.length > 0) {
        event.schedule.forEach(round => {
          if (round.matches && round.matches.length > 0) {
            round.matches.forEach(match => {
              totalMatches++;
              if (match.result && match.result.status === 'completed') {
                completedMatches++;
              } else if (match.result && match.result.status === 'in_progress') {
                liveMatches++;
              } else {
                upcomingMatches++;
              }
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalEvents,
          upcomingEvents,
          liveEvents,
          completedEvents,
          totalMatches,
          completedMatches,
          upcomingMatches,
          liveMatches
        },
        recentEvents: events.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Get scorer dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get assigned events
// @route   GET /api/scorer/events
// @access  Private (Scorer)
export const getAssignedEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const userId = req.user._id;

    const query = {
      'staff.user': userId,
      'staff.role': 'scorer'
    };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const events = await Event.find(query)
      .populate('sport', 'name slug icon')
      .populate('organizer', 'firstName lastName organizationName')
      .select('name sport organizer status startDate endDate location bannerImages schedule registeredPlayers registeredTeams')
      .sort({ startDate: -1 })
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
    console.error('Get assigned events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single assigned event
// @route   GET /api/scorer/events/:eventId
// @access  Private (Scorer)
export const getAssignedEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findOne({
      _id: eventId,
      'staff.user': userId,
      'staff.role': 'scorer'
    })
      .populate('sport', 'name slug icon formats')
      .populate('organizer', 'firstName lastName organizationName email phone')
      .populate('registeredPlayers.player', 'firstName lastName email')
      .populate('registeredTeams.team', 'name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or you are not assigned as scorer'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get assigned event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

