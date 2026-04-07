import Role from '../models/Role.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Team from '../models/Team.js';
import CoachTeam from '../models/CoachTeam.js';
import Event from '../models/Event.js';
import Court from '../models/Court.js';
import User from '../models/User.js';
import Player from '../models/Player.js';
import SportsAcademy from '../models/SportsAcademy.js';
import Coach from '../models/Coach.js';
import CoachStudentRelation from '../models/CoachStudentRelation.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import UserRoleSubscription from '../models/UserRoleSubscription.js';

const ELIGIBLE_SUBSCRIPTION_ROLES = ['coach', 'academyadmin', 'organizer'];
const PAID_PLANS = ['basic', 'premium', 'enterprise'];
const LIMIT_KEYS = ['maxTeams', 'maxPlayers', 'maxCourts', 'maxEvents'];
const getEffectiveRole = (user) => String(user?.activeRole || user?.role || '').toLowerCase();
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findRoleIdByName = async (roleName) => {
  const normalized = String(roleName || '').trim().toLowerCase();
  if (!normalized) return null;
  const exact = await Role.findOne({ name: normalized }).select('_id').lean();
  if (exact?._id) return exact._id;
  const ci = await Role.findOne({ name: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') } })
    .select('_id')
    .lean();
  return ci?._id || null;
};

const writeSubscriptionAuditLog = async ({
  actorUser = null,
  actorRole = '',
  eventType,
  decision = 'INFO',
  reasonCode = '',
  message = '',
  limitKey = '',
  planSlug = '',
  billingCycle = '',
  allowedLimit = 0,
  currentUsage = 0,
  attemptedIncrement = 0,
  metadata = {},
} = {}) => {
  try {
    await SubscriptionAuditLog.create({
      actorUser: actorUser || null,
      actorRole: String(actorRole || ''),
      eventType,
      decision,
      reasonCode,
      message,
      limitKey: String(limitKey || ''),
      planSlug: String(planSlug || ''),
      billingCycle: String(billingCycle || ''),
      allowedLimit: Number(allowedLimit || 0),
      currentUsage: Number(currentUsage || 0),
      attemptedIncrement: Number(attemptedIncrement || 0),
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Subscription audit log write failed:', error.message);
  }
};

const normalizeBillingCycle = (value) => {
  const normalized = String(value || 'monthly').trim().toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'monthly') return 'monthly';
  if (normalized === 'quarterly') return 'quarterly';
  if (normalized === 'halfyearly' || normalized === 'halfyear') return 'halfYearly';
  if (normalized === 'yearly' || normalized === 'annual') return 'yearly';
  return 'monthly';
};

const syncAndGetEffectiveRoleSubscription = async (user) => {
  if (!user?._id) return null;
  const now = new Date();
  const roleRefId = await getRoleRefIdForUser(user);
  if (!roleRefId) return null;

  await UserRoleSubscription.updateMany(
    {
      user: user._id,
      roleRef: roleRefId,
      status: 'active',
      expiresAt: { $lte: now },
    },
    {
      $set: { status: 'expired', endedAt: now },
    }
  );

  let activeSub = await UserRoleSubscription.findOne({
    user: user._id,
    roleRef: roleRefId,
    status: 'active',
    expiresAt: { $gt: now },
  })
    .sort({ startsAt: -1, createdAt: -1 })
    .lean();

  if (!activeSub) {
    const queued = await UserRoleSubscription.findOne({
      user: user._id,
      roleRef: roleRefId,
      status: 'queued',
      startsAt: { $lte: now },
    })
      .sort({ startsAt: 1, createdAt: 1 })
      .lean();

    if (queued?._id) {
      await UserRoleSubscription.updateOne(
        { _id: queued._id },
        { $set: { status: 'active', activatedAt: now } }
      );
      activeSub = { ...queued, status: 'active', activatedAt: now };
    }
  }

  if (activeSub) {
    const hasChanged =
      String(user.subscriptionPlan || '').toLowerCase() !== String(activeSub.planSlug || '').toLowerCase()
      || String(user.subscriptionBillingCycle || '') !== String(activeSub.billingCycle || '')
      || String(user.paymentStatus || '').toLowerCase() !== 'active'
      || Number(new Date(user.subscriptionExpiry || 0).getTime()) !== Number(new Date(activeSub.expiresAt).getTime());

    if (hasChanged) {
      user.subscriptionPlan = String(activeSub.planSlug || '').toLowerCase();
      user.subscriptionBillingCycle = String(activeSub.billingCycle || 'monthly');
      user.subscriptionExpiry = activeSub.expiresAt || null;
      user.paymentStatus = 'active';
      await user.save();
    }
    return activeSub;
  }

  return null;
};

const getRoleRefIdForUser = async (user) => {
  const activeRoleName = getEffectiveRole(user);
  if (activeRoleName) {
    const activeRoleId = await findRoleIdByName(activeRoleName);
    if (activeRoleId) return activeRoleId;
  }
  if (user?.roleRef) return user.roleRef;
  const roleName = String(user?.role || '').toLowerCase();
  if (!roleName) return null;
  const roleId = await findRoleIdByName(roleName);
  return roleId || null;
};

const getPlanForUser = async ({ user, activeRoleSubscription = null }) => {
  const roleRefId = activeRoleSubscription?.roleRef || (await getRoleRefIdForUser(user));
  const slug = String(activeRoleSubscription?.planSlug || user?.subscriptionPlan || '').trim().toLowerCase();
  if (!roleRefId || !slug) return null;
  return SubscriptionPlan.findOne({
    targetRoleRef: roleRefId,
    slug,
    isActive: true,
  }).select('slug limits limitsByCycle');
};

const getLimitForCycle = ({ plan, limitKey, billingCycle }) => {
  if (!plan || !LIMIT_KEYS.includes(limitKey)) return 0;
  const normalizedCycle = normalizeBillingCycle(billingCycle);
  const byCycle = plan?.limitsByCycle || {};
  const cycleLimits = byCycle?.[normalizedCycle] || byCycle?.monthly || {};
  const cycleValue = Number(cycleLimits?.[limitKey]);
  if (Number.isFinite(cycleValue)) return cycleValue;
  const legacyValue = Number(plan?.limits?.[limitKey]);
  if (Number.isFinite(legacyValue)) return legacyValue;
  return 0;
};

const getAcademyForAdmin = async (userId) =>
  SportsAcademy.findOne({ adminUser: userId }).select('_id').lean();

const getCoachForUser = async (userId) =>
  Coach.findOne({ userId }).select('_id').lean();

const getCurrentUsageForLimit = async ({ user, limitKey }) => {
  const role = getEffectiveRole(user);

  if (limitKey === 'maxTeams') {
    if (role === 'academyadmin') {
      const academy = await getAcademyForAdmin(user._id);
      if (!academy) return { count: 0, scopeMissing: true };
      const count = await Team.countDocuments({ academy: academy._id, isActive: true });
      return { count, scopeMissing: false };
    }
    if (role === 'coach') {
      const coach = await getCoachForUser(user._id);
      if (!coach) return { count: 0, scopeMissing: true };
      const count = await CoachTeam.countDocuments({ coach: coach._id, status: 'active' });
      return { count, scopeMissing: false };
    }
    if (role === 'organizer') {
      const count = await Team.countDocuments({ createdBy: user._id, isActive: true });
      return { count, scopeMissing: false };
    }
  }

  if (limitKey === 'maxEvents' && role === 'organizer') {
    const count = await Event.countDocuments({ organizer: user._id });
    return { count, scopeMissing: false };
  }

  if (limitKey === 'maxCourts' && role === 'academyadmin') {
    const academy = await getAcademyForAdmin(user._id);
    if (!academy) return { count: 0, scopeMissing: true };
    const count = await Court.countDocuments({ academy: academy._id });
    return { count, scopeMissing: false };
  }

  if (limitKey === 'maxPlayers') {
    if (role === 'academyadmin') {
      const academy = await getAcademyForAdmin(user._id);
      if (!academy) return { count: 0, scopeMissing: true };
      const count = await Player.countDocuments({
        academies: academy._id,
        isActive: true,
      });
      return { count, scopeMissing: false };
    }

    if (role === 'coach') {
      const coach = await getCoachForUser(user._id);
      if (!coach) return { count: 0, scopeMissing: true };
      const playerIds = await CoachStudentRelation.distinct('player', {
        coach: coach._id,
        status: 'active',
      });
      return { count: playerIds.length, scopeMissing: false };
    }
  }

  return { count: 0, scopeMissing: false };
};

export const assertWithinPlanLimit = async ({
  user,
  limitKey,
  increment = 1,
  currentUsage = null,
}) => {
  if (!user) {
    await writeSubscriptionAuditLog({
      eventType: 'SUBSCRIPTION_REQUIRED_BLOCK',
      decision: 'BLOCKED',
      reasonCode: 'AUTH_REQUIRED',
      message: 'Authentication required',
      limitKey,
      attemptedIncrement: increment,
    });
    return {
      allowed: false,
      status: 401,
      payload: { success: false, message: 'Authentication required' },
    };
  }

  const role = getEffectiveRole(user);
  if (role === 'superadmin') {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'BYPASS_SUPERADMIN',
      decision: 'ALLOWED',
      reasonCode: 'SUPERADMIN_BYPASS',
      message: 'Superadmin bypass for subscription limit enforcement',
      limitKey,
      attemptedIncrement: increment,
    });
    return { allowed: true, data: { bypassed: true } };
  }

  if (!ELIGIBLE_SUBSCRIPTION_ROLES.includes(role)) {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'SUBSCRIPTION_REQUIRED_BLOCK',
      decision: 'BLOCKED',
      reasonCode: 'ROLE_NOT_ELIGIBLE',
      message: `Role '${role}' does not support subscriptions`,
      limitKey,
      attemptedIncrement: increment,
    });
    return {
      allowed: false,
      status: 403,
      payload: {
        success: false,
        message: `Role '${role}' does not support subscriptions`,
      },
    };
  }

  const activeRoleSubscription = await syncAndGetEffectiveRoleSubscription(user);
  const hasActivePaidSubscription =
    activeRoleSubscription
    && PAID_PLANS.includes(String(activeRoleSubscription.planSlug || '').toLowerCase())
    && new Date(activeRoleSubscription.expiresAt) > new Date();

  if (!hasActivePaidSubscription) {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'SUBSCRIPTION_REQUIRED_BLOCK',
      decision: 'BLOCKED',
      reasonCode: 'SUBSCRIPTION_REQUIRED',
      message: 'Active paid subscription is required to use this feature',
      limitKey,
      attemptedIncrement: increment,
    });
    return {
      allowed: false,
      status: 402,
      payload: {
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Active paid subscription is required to use this feature',
      },
    };
  }

  const plan = await getPlanForUser({ user, activeRoleSubscription });
  if (!plan) {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'SUBSCRIPTION_PLAN_NOT_FOUND',
      decision: 'BLOCKED',
      reasonCode: 'PLAN_NOT_FOUND',
      message: 'No active plan found for current role and subscription',
      limitKey,
      attemptedIncrement: increment,
    });
    return {
      allowed: false,
      status: 403,
      payload: {
        success: false,
        code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
        message: 'No active plan found for current role and subscription',
      },
    };
  }

  const billingCycle = normalizeBillingCycle(
    activeRoleSubscription?.billingCycle || user.subscriptionBillingCycle
  );
  const allowedLimit = getLimitForCycle({ plan, limitKey, billingCycle });

  // Convention in this codebase: 0 (or less) means unlimited for numeric limits.
  if (allowedLimit <= 0) {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'LIMIT_CHECK_ALLOWED',
      decision: 'ALLOWED',
      reasonCode: 'UNLIMITED_OR_ZERO_LIMIT',
      message: 'Limit considered unlimited (<= 0)',
      limitKey,
      planSlug: plan.slug,
      billingCycle,
      allowedLimit,
      attemptedIncrement: increment,
    });
    return { allowed: true, data: { unlimited: true, allowedLimit, billingCycle, planSlug: plan.slug } };
  }

  const usage = currentUsage ?? (await getCurrentUsageForLimit({ user, limitKey })).count;
  const requestedIncrement = Number(increment || 0);
  const projected = usage + requestedIncrement;
  if (projected > allowedLimit) {
    await writeSubscriptionAuditLog({
      actorUser: user?._id,
      actorRole: role,
      eventType: 'LIMIT_CHECK_BLOCKED',
      decision: 'BLOCKED',
      reasonCode: 'PLAN_LIMIT_EXCEEDED',
      message: `Limit exceeded for ${limitKey}`,
      limitKey,
      planSlug: plan.slug,
      billingCycle,
      allowedLimit,
      currentUsage: usage,
      attemptedIncrement: requestedIncrement,
      metadata: { projected },
    });
    return {
      allowed: false,
      status: 403,
      payload: {
        success: false,
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Limit exceeded for ${limitKey}`,
        limitKey,
        currentUsage: usage,
        attemptedIncrement: requestedIncrement,
        allowedLimit,
        billingCycle,
        planSlug: plan.slug,
      },
    };
  }

  await writeSubscriptionAuditLog({
    actorUser: user?._id,
    actorRole: role,
    eventType: 'LIMIT_CHECK_ALLOWED',
    decision: 'ALLOWED',
    reasonCode: 'WITHIN_LIMIT',
    message: `Within limit for ${limitKey}`,
    limitKey,
    planSlug: plan.slug,
    billingCycle,
    allowedLimit,
    currentUsage: usage,
    attemptedIncrement: requestedIncrement,
    metadata: { projected },
  });

  return {
    allowed: true,
    data: {
      allowedLimit,
      billingCycle,
      planSlug: plan.slug,
      currentUsage: usage,
      attemptedIncrement: requestedIncrement,
    },
  };
};

const buildLimitMiddleware = (limitKey, getIncrement = null) => {
  return async (req, res, next) => {
    try {
      const increment = typeof getIncrement === 'function' ? Number(await getIncrement(req)) || 0 : 1;
      const usage = await getCurrentUsageForLimit({ user: req.user, limitKey });
      if (usage.scopeMissing) {
        await writeSubscriptionAuditLog({
          actorUser: req.user?._id,
          actorRole: req.user?.role,
          eventType: 'SCOPE_NOT_FOUND',
          decision: 'BLOCKED',
          reasonCode: 'SUBSCRIPTION_SCOPE_NOT_FOUND',
          message: 'Cannot enforce subscription limits because role scope was not found',
          limitKey,
          attemptedIncrement: increment,
        });
        return res.status(400).json({
          success: false,
          code: 'SUBSCRIPTION_SCOPE_NOT_FOUND',
          message: 'Cannot enforce subscription limits because role scope was not found',
          limitKey,
        });
      }
      const result = await assertWithinPlanLimit({
        user: req.user,
        limitKey,
        increment,
        currentUsage: usage.count,
      });
      if (!result.allowed) {
        return res.status(result.status).json(result.payload);
      }
      return next();
    } catch (error) {
      console.error(`Subscription limit middleware (${limitKey}) error:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error enforcing subscription limits',
        error: error.message,
      });
    }
  };
};

export const requireActiveSubscription = (...roles) => {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Super admin should never be blocked by subscription checks.
    if (getEffectiveRole(user) === 'superadmin') {
      return next();
    }

    const role = getEffectiveRole(user);
    if (roles.length > 0 && !roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${role}' is not allowed for this subscription-gated action`,
      });
    }

    if (!ELIGIBLE_SUBSCRIPTION_ROLES.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${role}' does not support subscriptions`,
      });
    }

    const activeRoleSubscription = await syncAndGetEffectiveRoleSubscription(user);
    const hasActivePaidSubscription =
      activeRoleSubscription
      && PAID_PLANS.includes(String(activeRoleSubscription.planSlug || '').toLowerCase())
      && new Date(activeRoleSubscription.expiresAt) > new Date();

    if (!hasActivePaidSubscription) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Active paid subscription is required to use this feature',
      });
    }

    return next();
  };
};

export const enforceTeamCreationLimit = () => buildLimitMiddleware('maxTeams');

export const enforceEventCreationLimit = () => buildLimitMiddleware('maxEvents');

export const enforceCourtCreationLimit = ({ bulk = false } = {}) =>
  buildLimitMiddleware('maxCourts', (req) => {
    if (!bulk) return 1;
    let parsed = [];
    try {
      parsed = JSON.parse(req.body?.courts || '[]');
    } catch (_error) {
      return 1;
    }
    return Array.isArray(parsed) ? parsed.length : 0;
  });

export const enforceAcademyPlayerLimitForInvite = () =>
  buildLimitMiddleware('maxPlayers', async (req) => {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!normalizedEmail) return 1;

    const academy = await getAcademyForAdmin(req.user?._id);
    if (!academy) return 1;

    const user = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (!user?._id) return 1;

    const existingPlayer = await Player.findOne({ user: user._id }).select('academies').lean();
    if (!existingPlayer?._id) return 1;

    const alreadyLinked = (existingPlayer.academies || []).some(
      (academyId) => String(academyId) === String(academy._id)
    );
    return alreadyLinked ? 0 : 1;
  });

