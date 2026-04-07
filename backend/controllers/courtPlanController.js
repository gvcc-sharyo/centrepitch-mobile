// ==========================================
// controllers/courtPlanController.js
// Court Subscription Plan Management Controller
// ==========================================

import CourtSubscriptionPlan from '../models/CourtSubscriptionPlan.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Court from '../models/Court.js';

// ==========================================
// ACADEMY ADMIN OPERATIONS
// ==========================================

/**
 * @desc    Create new court subscription plan
 * @route   POST /api/court-plans
 * @access  Private/AcademyAdmin
 */
export const createCourtPlan = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    const {
      name,
      description,
      applicableCourts,
      applyToAllCourts,
      durationMonths,
      sessionConfig,
      timeRestrictions,
      pricing,
      tax,
      bookingRules,
      limits,
      features,
      autoRenewal,
      validity,
      status,
      isFeatured,
      sortOrder
    } = req.body;

    // Validate applicable courts belong to this academy
    if (applicableCourts && applicableCourts.length > 0 && !applyToAllCourts) {
      const courts = await Court.find({
        _id: { $in: applicableCourts },
        academy: academy._id
      });

      if (courts.length !== applicableCourts.length) {
        return res.status(400).json({
          success: false,
          message: 'Some courts do not belong to your academy'
        });
      }
    }

    const plan = await CourtSubscriptionPlan.create({
      name,
      description,
      academy: academy._id,
      applicableCourts: applyToAllCourts ? [] : applicableCourts,
      applyToAllCourts,
      durationMonths,
      sessionConfig,
      timeRestrictions,
      pricing,
      tax,
      bookingRules,
      limits,
      features,
      autoRenewal,
      validity,
      status: status || 'DRAFT',
      isFeatured,
      sortOrder
    });

    await plan.populate('applicableCourts', 'name sportType courtType');

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Create court plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription plan',
      error: error.message
    });
  }
};

/**
 * @desc    Get all court plans for my academy
 * @route   GET /api/court-plans/my
 * @access  Private/AcademyAdmin
 */
export const getMyCourtPlans = async (req, res) => {
  try {
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: 'Academy not found'
      });
    }

    const { status, isActive } = req.query;
    let query = { academy: academy._id };

    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const plans = await CourtSubscriptionPlan.find(query)
      .populate('applicableCourts', 'name sportType courtType images')
      .sort({ sortOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    console.error('Get my court plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plans',
      error: error.message
    });
  }
};

/**
 * @desc    Get single court plan by ID
 * @route   GET /api/court-plans/:id
 * @access  Private/AcademyAdmin
 */
export const getCourtPlanById = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findById(req.params.id)
      .populate('applicableCourts', 'name sportType courtType images pricing')
      .populate('academy', 'name logo');

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Verify ownership if not super admin
    if (req.user.role === 'academyadmin') {
      const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
      if (!academy || plan.academy._id.toString() !== academy._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get court plan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plan',
      error: error.message
    });
  }
};

/**
 * @desc    Update court plan
 * @route   PUT /api/court-plans/:id
 * @access  Private/AcademyAdmin
 */
export const updateCourtPlan = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Verify ownership
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || plan.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const {
      name,
      description,
      applicableCourts,
      applyToAllCourts,
      durationMonths,
      sessionConfig,
      timeRestrictions,
      pricing,
      tax,
      bookingRules,
      limits,
      features,
      autoRenewal,
      validity,
      status,
      isActive,
      isFeatured,
      sortOrder
    } = req.body;

    // Validate applicable courts if provided
    if (applicableCourts && applicableCourts.length > 0 && !applyToAllCourts) {
      const courts = await Court.find({
        _id: { $in: applicableCourts },
        academy: academy._id
      });

      if (courts.length !== applicableCourts.length) {
        return res.status(400).json({
          success: false,
          message: 'Some courts do not belong to your academy'
        });
      }
    }

    // Update fields
    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (applyToAllCourts !== undefined) {
      plan.applyToAllCourts = applyToAllCourts;
      plan.applicableCourts = applyToAllCourts ? [] : (applicableCourts || plan.applicableCourts);
    } else if (applicableCourts !== undefined) {
      plan.applicableCourts = applicableCourts;
    }
    if (durationMonths !== undefined) plan.durationMonths = durationMonths;
    if (sessionConfig !== undefined) {
      plan.sessionConfig = { ...plan.sessionConfig, ...sessionConfig };
      delete plan.sessionConfig.minHoursPerSession; // Removed - only max hours used
    }
    if (timeRestrictions !== undefined) plan.timeRestrictions = { ...plan.timeRestrictions, ...timeRestrictions };
    if (pricing !== undefined) plan.pricing = { ...plan.pricing, ...pricing };
    if (tax !== undefined) plan.tax = { ...plan.tax, ...tax };
    if (bookingRules !== undefined) plan.bookingRules = { ...plan.bookingRules, ...bookingRules };
    if (limits !== undefined) plan.limits = { ...plan.limits, ...limits };
    if (features !== undefined) plan.features = features;
    if (autoRenewal !== undefined) plan.autoRenewal = { ...plan.autoRenewal, ...autoRenewal };
    if (validity !== undefined) plan.validity = { ...plan.validity, ...validity };
    if (status !== undefined) plan.status = status;
    if (isActive !== undefined) plan.isActive = isActive;
    if (isFeatured !== undefined) plan.isFeatured = isFeatured;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;

    await plan.save();
    await plan.populate('applicableCourts', 'name sportType courtType');

    res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Update court plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subscription plan',
      error: error.message
    });
  }
};

/**
 * @desc    Delete court plan
 * @route   DELETE /api/court-plans/:id
 * @access  Private/AcademyAdmin
 */
export const deleteCourtPlan = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Verify ownership
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || plan.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if there are active subscribers
    if (plan.limits.currentSubscribers > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete plan with active subscribers. Archive it instead.'
      });
    }

    await CourtSubscriptionPlan.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete court plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting subscription plan',
      error: error.message
    });
  }
};

/**
 * @desc    Toggle plan status (ACTIVE <-> PAUSED)
 * @route   PUT /api/court-plans/:id/toggle-status
 * @access  Private/AcademyAdmin
 */
export const togglePlanStatus = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Verify ownership
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || plan.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (plan.status === 'DRAFT') {
      plan.status = 'ACTIVE';
    } else if (plan.status === 'ACTIVE') {
      plan.status = 'PAUSED';
    } else if (plan.status === 'PAUSED') {
      plan.status = 'ACTIVE';
    } else {
      return res.status(400).json({
        success: false,
        message: `Cannot toggle status for plans in "${plan.status}" state`
      });
    }

    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.status === 'ACTIVE' ? 'activated' : 'paused'} successfully`,
      data: plan
    });
  } catch (error) {
    console.error('Toggle plan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling plan status',
      error: error.message
    });
  }
};

/**
 * @desc    Duplicate a plan
 * @route   POST /api/court-plans/:id/duplicate
 * @access  Private/AcademyAdmin
 */
export const duplicatePlan = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Verify ownership
    const academy = await SportsAcademy.findOne({ adminUser: req.user._id });
    if (!academy || plan.academy.toString() !== academy._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const planData = plan.toObject();
    delete planData._id;
    delete planData.createdAt;
    delete planData.updatedAt;
    planData.name = `${plan.name} (Copy)`;
    planData.status = 'DRAFT';
    planData.stats = { totalSubscriptions: 0, activeSubscriptions: 0, totalRevenue: 0 };
    planData.limits = { ...planData.limits, currentSubscribers: 0 };

    const newPlan = await CourtSubscriptionPlan.create(planData);
    await newPlan.populate('applicableCourts', 'name sportType courtType');

    res.status(201).json({
      success: true,
      message: 'Plan duplicated successfully',
      data: newPlan
    });
  } catch (error) {
    console.error('Duplicate plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error duplicating plan',
      error: error.message
    });
  }
};

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

/**
 * @desc    Get active plans for an academy (public)
 * @route   GET /api/court-plans/public/academy/:academyId
 * @access  Public
 */
export const getPublicAcademyPlans = async (req, res) => {
  try {
    const { academyId } = req.params;

    const plans = await CourtSubscriptionPlan.find({
      academy: academyId,
      isActive: true,
      status: 'ACTIVE'
    })
      .populate('applicableCourts', 'name sportType courtType images')
      .populate('academy', 'name logo')
      .sort({ isFeatured: -1, sortOrder: 1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    console.error('Get public academy plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plans',
      error: error.message
    });
  }
};

/**
 * @desc    Get plan details (public)
 * @route   GET /api/court-plans/public/:id
 * @access  Public
 */
export const getPublicPlanById = async (req, res) => {
  try {
    const plan = await CourtSubscriptionPlan.findOne({
      _id: req.params.id,
      isActive: true,
      status: 'ACTIVE'
    })
      .populate('applicableCourts', 'name sportType courtType images pricing amenities')
      .populate('academy', 'name logo address');

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get public plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plan',
      error: error.message
    });
  }
};
