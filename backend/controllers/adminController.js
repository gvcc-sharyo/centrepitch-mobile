import User from '../models/User.js';
import Event from '../models/Event.js';
import sendEmail, { emailTemplates } from '../utils/sendEmail.js';
import Team from '../models/Team.js';
import Payment from '../models/Payment.js';
import Query from '../models/Query.js';
import Notification from '../models/Notification.js';
import PlatformSettings from '../models/PlatformSettings.js';
import Sport from '../models/Sport.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Coach from '../models/Coach.js';
import Court from '../models/Court.js';
import { DUPLICATE_EMAIL_MESSAGE } from '../constants/contactErrors.js';

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const PLAYER_USER_QUERY = {
  $or: [
    { role: 'player' },
    { baseRole: 'player' },
    { 'unlockedRoles.role': 'player' }
  ]
};

const getDateRangeFromQuery = (query = {}) => {
  const now = new Date();
  const range = String(query.range || 'thisYear').trim();
  const customStart = query.startDate ? new Date(query.startDate) : null;
  const customEnd = query.endDate ? new Date(query.endDate) : null;

  if (range === 'thisMonth') {
    return {
      key: 'thisMonth',
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now
    };
  }

  if (range === 'thisQuarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      key: 'thisQuarter',
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: now
    };
  }

  if (range === 'all') {
    return { key: 'all', start: null, end: null };
  }

  if (range === 'custom' && customStart && customEnd && !Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
    const inclusiveEnd = new Date(customEnd);
    inclusiveEnd.setHours(23, 59, 59, 999);
    return {
      key: 'custom',
      start: customStart,
      end: inclusiveEnd
    };
  }

  return {
    key: 'thisYear',
    start: new Date(now.getFullYear(), 0, 1),
    end: now
  };
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Super Admin)
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const selectedRange = getDateRangeFromQuery(req.query || {});
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const selectedDateMatch = selectedRange.start && selectedRange.end
      ? { createdAt: { $gte: selectedRange.start, $lte: selectedRange.end } }
      : {};
    const selectedPaidDateMatch = selectedRange.start && selectedRange.end
      ? { paidAt: { $gte: selectedRange.start, $lte: selectedRange.end } }
      : {};

    // =========================
    // User and entity operations
    // =========================
    // const [
    //   totalOrganizers,
    //   activeOrganizers,
    //   deactivatedOrganizers,
    //   totalPlayers,
    //   activePlayers,
    //   deactivatedPlayers,
    //   totalAcademies,
    //   activeAcademies,
    //   deactivatedAcademies,
    //   totalCoaches,
    //   activeCoaches,
    //   deactivatedCoaches,
    //   pendingCoachKyc,
    //   rejectedCoachKyc,
    //   incompleteCoachKyc,
    //   totalTeams,
    //   activeTeams,
    //   deactivatedTeams,
    //   pendingAcademyKyc,
    //   rejectedAcademyKyc,
    //   incompleteAcademyKyc
    // ] = await Promise.all([
    //   User.countDocuments({ unlockedRoles: { $elemMatch: { role: 'organizer' } } }),
    //   User.countDocuments({ unlockedRoles: { $elemMatch: { role: 'organizer' } }, isActive: true }),
    //   User.countDocuments({ unlockedRoles: { $elemMatch: { role: 'organizer' } }, isActive: false }),
    //   User.countDocuments(PLAYER_USER_QUERY),
    //   User.countDocuments({ ...PLAYER_USER_QUERY, isActive: true }),
    //   User.countDocuments({ ...PLAYER_USER_QUERY, isActive: false }),
    //   SportsAcademy.countDocuments({}),
    //   SportsAcademy.countDocuments({ isActive: true }),
    //   SportsAcademy.countDocuments({ isActive: false }),
    //   Coach.countDocuments({}),
    //   Coach.countDocuments({ isActive: true }),
    //   Coach.countDocuments({ isActive: false }),
    //   Coach.countDocuments({ kycStatus: "PENDING" }),
    //   Coach.countDocuments({ kycStatus: "REJECTED" }),
    //   Coach.countDocuments({ kycStatus: "INCOMPLETE" }),
    //   Team.countDocuments({}),
    //   Team.countDocuments({ isActive: true }),
    //   Team.countDocuments({ isActive: false }),
    //   SportsAcademy.countDocuments({ kycStatus: "PENDING" }),
    //   SportsAcademy.countDocuments({ kycStatus: "REJECTED" }),
    //   SportsAcademy.countDocuments({ kycStatus: "INCOMPLETE" }),
    // ]);

    // =========================
    // User and entity operations
    // =========================
    const unlockedRoleQuery = (role, extra = {}) => ({
      unlockedRoles: { $elemMatch: { role } },
      ...extra
    });

    const [
      totalOrganizers,
      activeOrganizers,
      deactivatedOrganizers,

      totalPlayers,
      activePlayers,
      deactivatedPlayers,

      totalAcademies,
      activeAcademies,
      deactivatedAcademies,

      totalCoaches,
      activeCoaches,
      deactivatedCoaches,

      totalScorers,
      activeScorers,
      deactivatedScorers,

      totalTeams,
      activeTeams,
      deactivatedTeams,

      // KYC counts (entity-level)
      pendingCoachKyc,
      rejectedCoachKyc,
      incompleteCoachKyc,

      pendingAcademyKyc,
      rejectedAcademyKyc,
      incompleteAcademyKyc
    ] = await Promise.all([
      // Organizer totals (by unlocked role)
      User.countDocuments(unlockedRoleQuery('organizer')),
      User.countDocuments(unlockedRoleQuery('organizer', { isActive: true })),
      User.countDocuments(unlockedRoleQuery('organizer', { isActive: false })),

      // Player totals (by unlocked role)
      User.countDocuments(unlockedRoleQuery('player')),
      User.countDocuments(unlockedRoleQuery('player', { isActive: true })),
      User.countDocuments(unlockedRoleQuery('player', { isActive: false })),

      // Academy totals (by unlocked role)
      User.countDocuments(unlockedRoleQuery('academyadmin')),
      User.countDocuments(unlockedRoleQuery('academyadmin', { isActive: true })),
      User.countDocuments(unlockedRoleQuery('academyadmin', { isActive: false })),

      // Coach totals (by unlocked role)
      User.countDocuments(unlockedRoleQuery('coach')),
      User.countDocuments(unlockedRoleQuery('coach', { isActive: true })),
      User.countDocuments(unlockedRoleQuery('coach', { isActive: false })),

      // Scorer totals (by unlocked role)
      User.countDocuments(unlockedRoleQuery('scorer')),
      User.countDocuments(unlockedRoleQuery('scorer', { isActive: true })),
      User.countDocuments(unlockedRoleQuery('scorer', { isActive: false })),

      // Team totals
      Team.countDocuments({}),
      Team.countDocuments({ isActive: true }),
      Team.countDocuments({ isActive: false }),

      // Coach KYC
      Coach.countDocuments({ kycStatus: 'PENDING' }),
      Coach.countDocuments({ kycStatus: 'REJECTED' }),
      Coach.countDocuments({ kycStatus: 'INCOMPLETE' }),

      // Academy KYC
      SportsAcademy.countDocuments({ kycStatus: 'PENDING' }),
      SportsAcademy.countDocuments({ kycStatus: 'REJECTED' }),
      SportsAcademy.countDocuments({ kycStatus: 'INCOMPLETE' })
    ]);

    // Event statistics
    const [
      totalEvents,
      liveEvents,
      upcomingEvents,
      completedEvents,
      cancelledEvents
    ] = await Promise.all([
      Event.countDocuments({}),
      Event.countDocuments({ status: 'live' }),
      Event.countDocuments({ status: 'upcoming' }),
      Event.countDocuments({ status: 'completed' }),
      Event.countDocuments({ status: 'cancelled' }),
    ]);

    // Court operations
    const [
      totalCourts,
      liveCourts,
      maintenanceCourts,
      draftCourts,
      rejectedCourts,
      suspendedCourts,
      deactivatedCourts
    ] = await Promise.all([
      Court.countDocuments({}),
      Court.countDocuments({ status: 'APPROVED', isActive: true }),
      Court.countDocuments({ status: 'MAINTENANCE', isActive: true }),
      Court.countDocuments({ status: 'DRAFT', isActive: true }),
      Court.countDocuments({ status: 'REJECTED', isActive: true }),
      Court.countDocuments({ status: 'SUSPENDED', isActive: true }),
      Court.countDocuments({ isActive: false }),
    ]);

    // =========================
    // Financial analytics
    // =========================
    // Event tickets: platformFee = superadmin cut, netAmount = share owed to organizer (cash out).
    // Role subscriptions: full amount is superadmin revenue; platformFee is often 0 so netAmount === amount
    // via pre-save — those must NOT be counted as organizer payout expense.
    const subscriptionIncomeTypes = [
      'organizer_subscription',
      'academy_subscription',
      'coach_subscription',
      'platform_fee',
    ];

    const completedPlatformIncomeStages = {
      completedGrossRevenue: {
        $sum: {
          $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$amount', 0] }, 0],
        },
      },
      completedPlatformEarnings: {
        $sum: {
          $cond: [
            { $eq: ['$status', 'completed'] },
            {
              $add: [
                {
                  $cond: [
                    { $eq: ['$paymentType', 'event_registration'] },
                    { $ifNull: ['$platformFee', 0] },
                    0,
                  ],
                },
                {
                  $cond: [
                    { $in: ['$paymentType', subscriptionIncomeTypes] },
                    { $ifNull: ['$amount', 0] },
                    0,
                  ],
                },
              ],
            },
            0,
          ],
        },
      },
      completedPayoutExpense: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ['$status', 'completed'] },
                { $eq: ['$paymentType', 'event_registration'] },
              ],
            },
            { $ifNull: ['$netAmount', 0] },
            0,
          ],
        },
      },
      refundExpense: {
        $sum: {
          $cond: [
            { $eq: ['$status', 'refunded'] },
            { $ifNull: ['$refundAmount', '$amount'] },
            0,
          ],
        },
      },
    };

    const paymentSummary = await Payment.aggregate([
      {
        $group: {
          _id: null,
          ...completedPlatformIncomeStages,
        },
      },
    ]);

    const yearlyPaymentSummary = await Payment.aggregate([
      { $match: selectedDateMatch },
      {
        $group: {
          _id: null,
          ...completedPlatformIncomeStages,
        },
      },
    ]);

    const overallFinance = paymentSummary[0] || {};
    const yearlyFinance = yearlyPaymentSummary[0] || {};
    const overallProfit = Number(overallFinance.completedPlatformEarnings || 0) - Number(overallFinance.refundExpense || 0);
    const yearlyProfit = Number(yearlyFinance.completedPlatformEarnings || 0) - Number(yearlyFinance.refundExpense || 0);
    const totalRevenue = Number(overallFinance.completedGrossRevenue || 0);
    const platformEarnings = Number(overallFinance.completedPlatformEarnings || 0);

    // Recent registrations
    const recentUsers = await User.find()
      .select('firstName lastName email unlockedRoles.role createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Event distribution by sport (same date range as dashboard filter; all-time when range=all)
    const eventDistribution = await Event.aggregate([
      ...(Object.keys(selectedDateMatch).length > 0 ? [{ $match: selectedDateMatch }] : []),
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

    const revenueTrend = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          ...selectedPaidDateMatch
        }
      },
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
    ]);

    // User growth (selected range)
    const userGrowth = await User.aggregate([
      {
        $match: selectedDateMatch
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        counts: {
          totalOrganizers,
          activeOrganizers,
          deactivatedOrganizers,
          totalPlayers,
          activePlayers,
          deactivatedPlayers,
          totalAcademies,
          activeAcademies,
          deactivatedAcademies,
          totalCoaches,
          activeCoaches,
          deactivatedCoaches,
          pendingCoachKyc,
          rejectedCoachKyc,
          incompleteCoachKyc,
          totalTeams,
          activeTeams,
          deactivatedTeams,
          pendingAcademyKyc,
          rejectedAcademyKyc,
          incompleteAcademyKyc,
          totalEvents,
          liveEvents,
          upcomingEvents,
          completedEvents,
          cancelledEvents,
          totalCourts,
          liveCourts,
          maintenanceCourts,
          draftCourts,
          rejectedCourts,
          suspendedCourts,
          deactivatedCourts,
        },
        revenue: {
          totalRevenue,
          platformEarnings,
          netRevenue: totalRevenue - platformEarnings
        },
        finance: {
          overall: {
            revenueGenerated: Number(overallFinance.completedGrossRevenue || 0),
            earning: Number(overallFinance.completedPlatformEarnings || 0),
            // Refunds only — superadmin outflows (subscriptions / fees are never "expense" here)
            expense: Number(overallFinance.refundExpense || 0),
            payoutExpense: Number(overallFinance.completedPayoutExpense || 0),
            refundExpense: Number(overallFinance.refundExpense || 0),
            totalCashOut:
              Number(overallFinance.completedPayoutExpense || 0) +
              Number(overallFinance.refundExpense || 0),
            profit: overallProfit,
            loss: overallProfit < 0 ? Math.abs(overallProfit) : 0,
          },
          thisYear: {
            year: selectedRange.key === 'thisYear' ? now.getFullYear() : null,
            revenueGenerated: Number(yearlyFinance.completedGrossRevenue || 0),
            earning: Number(yearlyFinance.completedPlatformEarnings || 0),
            expense: Number(yearlyFinance.refundExpense || 0),
            payoutExpense: Number(yearlyFinance.completedPayoutExpense || 0),
            refundExpense: Number(yearlyFinance.refundExpense || 0),
            totalCashOut:
              Number(yearlyFinance.completedPayoutExpense || 0) +
              Number(yearlyFinance.refundExpense || 0),
            profit: yearlyProfit,
            loss: yearlyProfit < 0 ? Math.abs(yearlyProfit) : 0,
          },
        },
        filters: {
          range: selectedRange.key,
          startDate: selectedRange.start,
          endDate: selectedRange.end,
        },
        recentUsers,
        eventDistribution: eventDistribution.map(e => ({
          type: e._id,
          count: e.count,
          eventType: e.eventType,
        })),
        revenueTrend: revenueTrend.map(r => ({
          period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
          revenue: r.revenue,
          transactions: r.count
        })),
        userGrowth
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all organizers
// @route   GET /api/admin/organizers
// @access  Private (Super Admin)
export const getOrganizers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = { role: 'organizer' };

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { organizationName: new RegExp(search, 'i') }
      ];
    }

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const organizers = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get event count for each organizer
    const organizerData = await Promise.all(
      organizers.map(async (org) => {
        const eventCount = await Event.countDocuments({ organizer: org._id });
        const revenue = await Payment.aggregate([
          {
            $lookup: {
              from: 'events',
              localField: 'event',
              foreignField: '_id',
              as: 'eventDetails'
            }
          },
          {
            $match: {
              'eventDetails.organizer': org._id,
              status: 'completed'
            }
          },
          {
            $group: { _id: null, total: { $sum: '$amount' } }
          }
        ]);

        return {
          ...org.toObject(),
          eventCount,
          totalRevenue: revenue[0]?.total || 0
        };
      })
    );

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: organizerData,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get organizers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add new organizer
// @route   POST /api/admin/organizers
// @access  Private (Super Admin)
export const addOrganizer = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, organizationName } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').trim();

    if (!firstName || !lastName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, email, and password are required'
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE
      });
    }

    const organizer = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      phone: normalizedPhone,
      organizationName,
      role: 'organizer',
      isVerified: false,
      isEmailVerified: false,
      isPhoneVerified: false
    });

    // Generate email OTP for first-login verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    organizer.emailOtp = otp;
    organizer.emailOtpExpire = Date.now() + 10 * 60 * 1000;
    organizer.otp = otp; // backward compatibility
    organizer.otpExpire = organizer.emailOtpExpire;
    await organizer.save();

    try {
      const userName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Organizer';
      const emailTemplate = emailTemplates.otpVerification(otp, userName);
      await sendEmail({
        to: normalizedEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (emailErr) {
      console.error('Failed to send organizer welcome email:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Organizer account created. Verification OTP sent to email.',
      data: {
        _id: organizer._id,
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        email: organizer.email,
        organizationName: organizer.organizationName
      }
    });
  } catch (error) {
    console.error('Add organizer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update organizer status
// @route   PUT /api/admin/organizers/:id/status
// @access  Private (Super Admin)
export const updateOrganizerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const organizer = await User.findById(req.params.id);

    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found'
      });
    }

    organizer.isActive = isActive;
    await organizer.save();

    // Notify organizer
    await Notification.create({
      recipient: organizer._id,
      sender: req.user._id,
      type: 'announcement',
      title: isActive ? 'Account Activated' : 'Account Deactivated',
      message: isActive
        ? 'Your organizer account has been activated.'
        : 'Your organizer account has been deactivated. Please contact support for more information.'
    });

    res.json({
      success: true,
      message: `Organizer ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update organizer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete organizer
// @route   DELETE /api/admin/organizers/:id
// @access  Private (Super Admin)
export const deleteOrganizer = async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);

    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found'
      });
    }

    // Check if organizer has any active events
    const activeEvents = await Event.countDocuments({
      organizer: req.params.id,
      status: { $in: ['upcoming', 'live'] }
    });

    if (activeEvents > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete organizer with active events'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Organizer deleted successfully'
    });
  } catch (error) {
    console.error('Delete organizer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all registrations (excluding superadmin)
// @route   GET /api/admin/registrations
// @access  Private (Super Admin)
// export const getRegistrations = async (req, res) => {
//   try {
//     const { page = 1, limit = 12, search, role } = req.query;
//     const pageNum = Number(page);
//     const limitNum = Number(limit);

//     const query = { role: { $ne: 'superadmin' } };

//     if (search) {
//       const rx = new RegExp(search, 'i');
//       query.$or = [
//         { firstName: rx },
//         { lastName: rx },
//         { email: rx },
//         { organizationName: rx }
//       ];
//     }

//     // In this codebase many users are "player" by role OR baseRole/unlockedRoles.
//     if (role) {
//       if (role === 'player') {
//         query.$and = [
//           { role: 'player' },
//           {
//             $or: [
//               { unlockedRoles: { $exists: false } },
//               { unlockedRoles: { $size: 0 } },
//               {
//                 unlockedRoles: {
//                   $not: { $elemMatch: { role: { $ne: 'player' } } }
//                 }
//               }
//             ]
//           }
//         ];
//       } else {
//         query.$or = [
//           { role },
//           { unlockedRoles: { $elemMatch: { role } } }
//         ];
//       }
//     }
//       const users = await User.find(query)
//         .select('-password')
//         .sort({ createdAt: -1 })
//         .skip((pageNum - 1) * limitNum)
//         .limit(limitNum);

//       const total = await User.countDocuments(query);

//       res.json({
//         success: true,
//         data: users,
//         pagination: {
//           current: pageNum,
//           pages: Math.ceil(total / limitNum),
//           total
//         }
//       });
//     } catch (error) {
//       console.error('Get registrations error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Server error',
//         error: error.message
//       });
//     }
//   };

export const getRegistrations = async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', role = '' } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 12);

    const query = { role: { $ne: 'superadmin' } };
    const andClauses = [];

    const searchText = String(search).trim();
    if (searchText) {
      const rx = new RegExp(searchText, 'i');
      andClauses.push({
        $or: [
          { firstName: rx },
          { lastName: rx },
          { email: rx },
          { organizationName: rx }
        ]
      });
    }

    const normalizedRole = String(role).trim().toLowerCase();
    if (normalizedRole) {
      andClauses.push({
        $or: [
          { role: normalizedRole }, // active/current role
          { baseRole: normalizedRole }, // base role
          { unlockedRoles: { $elemMatch: { role: normalizedRole } } } // unlocked roles
        ]
      });
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    return res.json({
      success: true,
      data: users,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total
      }
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all players/participants
// @route   GET /api/admin/players
// @access  Private (Super Admin)
export const getPlayers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const filters = [PLAYER_USER_QUERY];

    if (search) {
      filters.push({
        $or: [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      });
    }

    if (status === 'active') filters.push({ isActive: true });
    if (status === 'inactive') filters.push({ isActive: false });

    const query = filters.length > 1 ? { $and: filters } : PLAYER_USER_QUERY;

    const players = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: players,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update player status
// @route   PUT /api/admin/players/:id/status
// @access  Private (Super Admin)
export const updatePlayerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const player = await User.findById(req.params.id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    player.isActive = isActive;
    await player.save();

    res.json({
      success: true,
      message: `Player ${isActive ? 'activated' : 'deactivated'} successfully`
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

// @desc    Activate all inactive accounts (bulk activation)
// @route   PUT /api/admin/users/activate-all
// @access  Private (Super Admin)
export const activateAllInactiveAccounts = async (req, res) => {
  try {
    const result = await User.updateMany(
      { isActive: false },
      { $set: { isActive: true } }
    );

    res.json({
      success: true,
      message: `Activated ${result.modifiedCount} inactive account(s)`,
      data: {
        activatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Activate all inactive accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all events for admin
// @route   GET /api/admin/events
// @access  Private (Super Admin)
export const getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sport,
      search,
      organizer,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const query = {};

    if (status) query.status = status;
    if (sport) query.sport = sport;
    if (organizer) query.organizer = organizer;

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { keywords: new RegExp(search, 'i') }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const events = await Event.find(query)
      .populate('sport', 'name slug icon formats')
      .populate('organizer', 'firstName lastName organizationName profilePhoto email phone')
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
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get platform revenue analysis
// @route   GET /api/admin/revenue
// @access  Private (Super Admin)
export const getRevenueAnalysis = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month', eventType } = req.query;
    const matchQuery = { status: 'completed' };

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

    // Revenue by organizer
    const revenueByOrganizer = await Payment.aggregate([
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
          from: 'users',
          localField: 'eventDetails.organizer',
          foreignField: '_id',
          as: 'organizerDetails'
        }
      },
      { $unwind: '$organizerDetails' },
      {
        $group: {
          _id: '$eventDetails.organizer',
          organizerName: { $first: { $concat: ['$organizerDetails.firstName', ' ', '$organizerDetails.lastName'] } },
          organizationName: { $first: '$organizerDetails.organizationName' },
          revenue: { $sum: '$amount' },
          platformFees: { $sum: '$platformFee' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    // Revenue by sport (with eventType fallback for backward compatibility)
    const revenueByEventType = await Payment.aggregate([
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
          _id: {
            $ifNull: ['$sportDetails.name', '$eventDetails.eventType']
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          sportId: { $first: '$eventDetails.sport' },
          eventType: { $first: '$eventDetails.eventType' }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          revenue: 1,
          transactions: 1,
          sportId: 1,
          eventType: 1
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
          platformFees: { $sum: '$platformFee' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totals: totalStats[0] || { totalRevenue: 0, platformFees: 0, totalTransactions: 0 },
        byOrganizer: revenueByOrganizer,
        byEventType: revenueByEventType.map(r => ({ type: r.type, revenue: r.revenue, transactions: r.transactions })),
        trend: revenueTrend.map(r => ({
          period: groupBy === 'day'
            ? `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`
            : groupBy === 'week'
              ? `${r._id.year}-W${r._id.week}`
              : `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
          revenue: r.revenue,
          platformFees: r.platformFees,
          transactions: r.transactions
        }))
      }
    });
  } catch (error) {
    console.error('Get revenue analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get event publish pricing
// @route   GET /api/admin/event-publish-pricing
// @access  Private (Super Admin)
export const getEventPublishPricing = async (req, res) => {
  try {
    const settings = await PlatformSettings.getActiveSettings();
    await settings.populate({
      path: 'eventPublishPricingHistory.changedBy',
      select: 'firstName lastName email'
    });
    await settings.populate({
      path: 'sportPublishPricing.sport',
      select: 'name slug'
    });
    const { baseAmount, gstPercent, currency } = settings.eventPublishPricing;
    const gstAmount = roundToTwo((baseAmount * gstPercent) / 100);
    const totalAmount = roundToTwo(baseAmount + gstAmount);
    const history = (settings.eventPublishPricingHistory || [])
      .slice()
      .reverse()
      .slice(0, 20)
      .map((item) => ({
        previous: item.previous,
        next: item.next,
        note: item.note || '',
        changedAt: item.changedAt,
        changedBy: item.changedBy ? {
          _id: item.changedBy._id,
          name: [item.changedBy.firstName, item.changedBy.lastName].filter(Boolean).join(' ').trim(),
          email: item.changedBy.email
        } : null
      }));

    res.json({
      success: true,
      data: {
        baseAmount,
        gstPercent,
        gstAmount,
        totalAmount,
        currency,
        history,
        sportPricing: (settings.sportPublishPricing || []).map((item) => {
          const sportName = item?.sport?.name || '';
          const sportSlug = item?.sport?.slug || '';
          const sportId = item?.sport?._id || item?.sport;
          const sportGstAmount = roundToTwo((Number(item.baseAmount || 0) * Number(item.gstPercent || 0)) / 100);
          const sportTotalAmount = roundToTwo(Number(item.baseAmount || 0) + sportGstAmount);
          return {
            sport: sportId,
            sportName,
            sportSlug,
            baseAmount: Number(item.baseAmount || 0),
            gstPercent: Number(item.gstPercent || 0),
            gstAmount: sportGstAmount,
            totalAmount: sportTotalAmount,
            currency: item.currency || currency,
            isActive: item.isActive !== false,
            updatedAt: item.updatedAt
          };
        })
      }
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

// @desc    Update event publish pricing
// @route   PUT /api/admin/event-publish-pricing
// @access  Private (Super Admin)
export const updateEventPublishPricing = async (req, res) => {
  try {
    const { baseAmount, gstPercent, currency = 'INR', note = '' } = req.body || {};

    if (baseAmount == null || Number(baseAmount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'baseAmount must be greater than or equal to 0'
      });
    }

    if (gstPercent == null || Number(gstPercent) < 0 || Number(gstPercent) > 100) {
      return res.status(400).json({
        success: false,
        message: 'gstPercent must be between 0 and 100'
      });
    }

    const settings = await PlatformSettings.getActiveSettings();
    const previousPricing = {
      baseAmount: Number(settings.eventPublishPricing?.baseAmount || 0),
      gstPercent: Number(settings.eventPublishPricing?.gstPercent || 0),
      currency: String(settings.eventPublishPricing?.currency || 'INR').toUpperCase()
    };
    const nextPricing = {
      baseAmount: Number(baseAmount),
      gstPercent: Number(gstPercent),
      currency: String(currency || 'INR').toUpperCase()
    };
    settings.eventPublishPricing = nextPricing;

    const pricingChanged = previousPricing.baseAmount !== nextPricing.baseAmount
      || previousPricing.gstPercent !== nextPricing.gstPercent
      || previousPricing.currency !== nextPricing.currency;

    if (pricingChanged) {
      settings.eventPublishPricingHistory = settings.eventPublishPricingHistory || [];
      settings.eventPublishPricingHistory.push({
        previous: previousPricing,
        next: nextPricing,
        changedBy: req.user?._id || null,
        note: String(note || '').trim(),
        changedAt: new Date()
      });
    }
    await settings.save();

    const updated = settings.eventPublishPricing;
    const gstAmount = roundToTwo((updated.baseAmount * updated.gstPercent) / 100);
    const totalAmount = roundToTwo(updated.baseAmount + gstAmount);
    const history = (settings.eventPublishPricingHistory || [])
      .slice()
      .reverse()
      .slice(0, 20);

    res.json({
      success: true,
      message: 'Event publish pricing updated successfully',
      data: {
        baseAmount: updated.baseAmount,
        gstPercent: updated.gstPercent,
        gstAmount,
        totalAmount,
        currency: updated.currency,
        history
      }
    });
  } catch (error) {
    console.error('Update event publish pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Upsert sport-wise event publish pricing
// @route   PUT /api/admin/event-publish-pricing/sports/:sportId
// @access  Private (Super Admin)
export const upsertSportEventPublishPricing = async (req, res) => {
  try {
    const { sportId } = req.params;
    const { baseAmount, gstPercent, currency = 'INR', isActive = true } = req.body || {};

    if (!sportId) {
      return res.status(400).json({ success: false, message: 'sportId is required' });
    }
    const sport = await Sport.findById(sportId).select('_id name slug');
    if (!sport) {
      return res.status(404).json({ success: false, message: 'Sport not found' });
    }
    if (baseAmount == null || Number(baseAmount) < 0) {
      return res.status(400).json({ success: false, message: 'baseAmount must be greater than or equal to 0' });
    }
    if (gstPercent == null || Number(gstPercent) < 0 || Number(gstPercent) > 100) {
      return res.status(400).json({ success: false, message: 'gstPercent must be between 0 and 100' });
    }

    const settings = await PlatformSettings.getActiveSettings();
    settings.sportPublishPricing = settings.sportPublishPricing || [];

    const existingIndex = settings.sportPublishPricing.findIndex(
      (item) => String(item.sport) === String(sportId)
    );

    const next = {
      sport: sportId,
      baseAmount: Number(baseAmount),
      gstPercent: Number(gstPercent),
      currency: String(currency || 'INR').toUpperCase(),
      isActive: Boolean(isActive),
      updatedAt: new Date()
    };

    if (existingIndex >= 0) {
      settings.sportPublishPricing[existingIndex] = {
        ...settings.sportPublishPricing[existingIndex].toObject(),
        ...next
      };
    } else {
      settings.sportPublishPricing.push(next);
    }

    await settings.save();

    await settings.populate({
      path: 'sportPublishPricing.sport',
      select: 'name slug'
    });

    res.json({
      success: true,
      message: 'Sport publish pricing saved successfully',
      data: (settings.sportPublishPricing || []).map((item) => {
        const gstAmount = roundToTwo((Number(item.baseAmount || 0) * Number(item.gstPercent || 0)) / 100);
        return {
          sport: item?.sport?._id || item.sport,
          sportName: item?.sport?.name || '',
          sportSlug: item?.sport?.slug || '',
          baseAmount: Number(item.baseAmount || 0),
          gstPercent: Number(item.gstPercent || 0),
          gstAmount,
          totalAmount: roundToTwo(Number(item.baseAmount || 0) + gstAmount),
          currency: item.currency || 'INR',
          isActive: item.isActive !== false,
          updatedAt: item.updatedAt
        };
      })
    });
  } catch (error) {
    console.error('Upsert sport event publish pricing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get notifications for Super Admin (inbox + sent announcements)
// @route   GET /api/admin/notifications
// @access  Private (Super Admin)
export const getAdminNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, filter } = req.query;
    const userId = req.user._id;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const baseRecipientQuery = {
      $or: [
        { recipient: userId },
        { recipients: userId },
        { 'data.recipientIds': userId }
      ]
    };

    const sentQuery = { sender: userId, type: 'announcement' };

    const unreadCount = await Notification.countDocuments({
      ...baseRecipientQuery,
      isRead: false
    });

    const sentCount = await Notification.countDocuments(sentQuery);

    // Note: `recipient` is not on the Notification schema (use `recipients`); populating
    // missing paths throws StrictPopulateError and returns 500.
    const withPopulates = (q) =>
      q
        .populate('sender', 'firstName lastName profilePhoto role')
        .populate('recipients', 'firstName lastName email')
        .populate('data.eventId', 'name')
        .populate('data.teamId', 'name');

    if (filter === 'sent') {
      const notifications = await withPopulates(
        Notification.find(sentQuery)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
      ).lean();

      const data = notifications.map((n) => {
        const obj = { ...n };
        obj.data = obj.data || {};
        obj.data.sentByMe = true;
        return obj;
      });

      return res.json({
        success: true,
        data,
        unreadCount,
        sentCount,
        pagination: {
          current: pageNum,
          pages: Math.ceil(sentCount / limitNum) || 1,
          total: sentCount
        }
      });
    }

    if (
      filter === 'read' ||
      filter === 'unread' ||
      isRead !== undefined
    ) {
      const query = { ...baseRecipientQuery };
      if (filter === 'read' || isRead === 'true') query.isRead = true;
      if (filter === 'unread' || isRead === 'false') query.isRead = false;

      const notifications = await withPopulates(
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
      ).lean();

      const total = await Notification.countDocuments(query);

      return res.json({
        success: true,
        data: notifications,
        unreadCount,
        sentCount,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          total
        }
      });
    }

    const [received, sent] = await Promise.all([
      withPopulates(Notification.find(baseRecipientQuery).sort({ createdAt: -1 })).lean(),
      withPopulates(Notification.find(sentQuery).sort({ createdAt: -1 })).lean()
    ]);

    const sentMapped = sent.map((s) => {
      const obj = { ...s };
      obj.data = obj.data || {};
      obj.data.sentByMe = true;
      return obj;
    });

    const merged = [...received, ...sentMapped].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = merged.length;
    const skip = (pageNum - 1) * limitNum;
    const data = merged.slice(skip, skip + limitNum);

    return res.json({
      success: true,
      data,
      unreadCount,
      sentCount,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        total
      }
    });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Send announcement to all users
// @route   POST /api/admin/announcement
// @access  Private (Super Admin)
export const sendAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRoles, priority } = req.body;

    const query = { isActive: true };
    if (targetRoles && targetRoles.length > 0) {
      query.role = { $in: targetRoles };
    }

    const users = await User.find(query).select('_id');
    const recipientIds = users.map(u => u._id);

    // const notifications = users.map(user => ({
    //   recipient: user._id,
    //   sender: req.user._id,
    //   type: 'announcement',
    //   title,
    //   message,
    //   priority: priority || 'medium'
    // }));

    // await Notification.insertMany(notifications);

    // Create a notification for the super admin so it appears in Sent/Notifications as "Sent Announcement"
    await Notification.create({
      sender: req.user._id,
      type: 'announcement',
      title,
      message,
      priority: priority || 'medium',
      recipients: recipientIds,
      data: {
        additionalInfo: {
          sentByMe: true,
          recipientCount: recipientIds.length
        }
      }
    });

    res.json({
      success: true,
      message: `Announcement sent to ${users.length} users`
    });
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all queries
// @route   GET /api/admin/queries
// @access  Private (Super Admin)
export const getQueries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, priority, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    // Get all queries sent to any superadmin (in case there are multiple)
    const superAdmins = await User.find({ role: 'superadmin' }).select('_id');
    const superAdminIds = superAdmins.map(admin => admin._id);
    const query = { to: { $in: superAdminIds } };

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const usersMatchingName = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { organizationName: searchRegex }
        ]
      }).select('_id').lean();
      const userIds = usersMatchingName.map(u => u._id);
      query.$or = [
        { subject: searchRegex },
        { message: searchRegex },
        ...(userIds.length > 0 ? [{ from: { $in: userIds } }] : [])
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const queries = await Query.find(query)
      .populate('from', 'firstName lastName email organizationName profilePhoto')
      .populate('event', 'name')
      .sort(sortOptions)
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
    console.error('Get queries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single query
// @route   GET /api/admin/queries/:id
// @access  Private (Super Admin)
export const getQuery = async (req, res) => {
  try {
    const query = await Query.findById(req.params.id)
      .populate('from', 'firstName lastName email organizationName profilePhoto phone')
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
    console.error('Get query error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update query status
// @route   PUT /api/admin/queries/:id/status
// @access  Private (Super Admin)
export const updateQueryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const query = await Query.findById(req.params.id);

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    query.status = status;
    if (status === 'resolved' || status === 'closed') {
      query.resolvedAt = new Date();
      query.resolvedBy = req.user._id;
    }

    await query.save();

    // Notify the sender
    await Notification.create({
      recipient: query.from,
      sender: req.user._id,
      type: 'query_response',
      title: 'Query Status Updated',
      message: `Your query "${query.subject}" has been marked as ${status}`,
      data: { queryId: query._id }
    });

    res.json({
      success: true,
      message: 'Query status updated successfully',
      data: query
    });
  } catch (error) {
    console.error('Update query status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Respond to query
// @route   POST /api/admin/queries/:id/respond
// @access  Private (Super Admin)
export const respondToQuery = async (req, res) => {
  try {
    const { message, attachments } = req.body;
    const query = await Query.findById(req.params.id);

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    query.responses.push({
      from: req.user._id,
      message,
      attachments: attachments || []
    });

    // Update status if still open
    if (query.status === 'open') {
      query.status = 'in_progress';
    }

    await query.save();

    // Notify the sender
    await Notification.create({
      recipient: query.from,
      sender: req.user._id,
      type: 'query_response',
      title: 'Response to Your Query',
      message: `Admin has responded to your query: "${query.subject}"`,
      data: { queryId: query._id }
    });

    res.json({
      success: true,
      message: 'Response sent successfully',
      data: query
    });
  } catch (error) {
    console.error('Respond to query error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
