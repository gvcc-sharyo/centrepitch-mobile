import SubscriptionPlan from '../models/SubscriptionPlan.js';
import SubscriptionSlug from '../models/SubscriptionSlug.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Role from '../models/Role.js';
import UserRoleSubscription from '../models/UserRoleSubscription.js';
import SportsAcademy from '../models/SportsAcademy.js';
import { seedSubscriptionPlans } from '../services/subscriptionPlanSeedService.js';
import { seedSubscriptionSlugs } from '../services/subscriptionSlugSeedService.js';

const SUBSCRIPTION_ELIGIBLE_ROLES = ['coach', 'academyadmin', 'organizer'];
const SUPPORTED_BILLING_CYCLES = ['monthly', 'quarterly', 'halfYearly', 'yearly'];
const FEATURE_CYCLE_KEYS = ['monthly', 'quarterly', 'halfYearly', 'yearly'];
const LIMIT_CYCLE_KEYS = ['monthly', 'quarterly', 'halfYearly', 'yearly'];
const LIMIT_NUMBER_FIELDS = ['maxTeams', 'maxPlayers', 'maxCourts', 'maxEvents', 'maxCoaches', 'maxStorage'];
const LIMIT_BOOLEAN_FIELDS = ['analytics', 'prioritySupport', 'customBranding', 'apiAccess'];

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  return SUBSCRIPTION_ELIGIBLE_ROLES.includes(role) ? role : '';
};

const getPaymentTypeByRole = (role) => {
  if (role === 'coach') return 'coach_subscription';
  if (role === 'academyadmin') return 'academy_subscription';
  return 'organizer_subscription';
};

const normalizeBillingCycle = (value) => {
  const normalized = String(value || 'monthly').trim().toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'monthly') return 'monthly';
  if (normalized === 'quarterly') return 'quarterly';
  if (normalized === 'halfyearly' || normalized === 'halfyear') return 'halfYearly';
  if (normalized === 'yearly' || normalized === 'annual') return 'yearly';
  return '';
};

const normalizeSlug = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const toSlugLabel = (slug = '') =>
  String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || String(slug || '');

const upsertSubscriptionSlug = async ({ slug, label = '', actorId = null }) => {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;
  const normalizedLabel = String(label || '').trim() || toSlugLabel(normalizedSlug);
  const updated = await SubscriptionSlug.findOneAndUpdate(
    { slug: normalizedSlug },
    {
      $set: {
        label: normalizedLabel,
        isActive: true,
        updatedBy: actorId || null,
      },
      $setOnInsert: {
        createdBy: actorId || null,
        sortOrder: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return updated;
};

const getDaysForBillingCycle = (cycle) => {
  if (cycle === 'quarterly') return 90;
  if (cycle === 'halfYearly') return 182;
  if (cycle === 'yearly') return 365;
  return 30;
};

const getAmountForBillingCycle = (price = {}, cycle = 'monthly') => {
  const monthly = Number(price.monthly || 0);
  const yearly = Number(price.yearly || 0);
  if (cycle === 'quarterly') {
    const direct = Number(price.quarterly || 0);
    return direct > 0 ? direct : monthly * 3;
  }
  if (cycle === 'halfYearly') {
    const direct = Number(price.halfYearly || 0);
    if (direct > 0) return direct;
    if (monthly > 0) return monthly * 6;
    return yearly > 0 ? Math.round(yearly / 2) : 0;
  }
  if (cycle === 'yearly') return yearly;
  return monthly;
};

const normalizePaymentMethod = (method = 'other') => {
  const normalized = String(method || '').trim().toLowerCase();
  const allowed = ['card', 'upi', 'netbanking', 'wallet', 'other'];
  return allowed.includes(normalized) ? normalized : 'other';
};

const normalizeAcademyName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeFeatureList = (list = []) => {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      text: String(item?.text || '').trim(),
      included: item?.included !== false,
      highlight: Boolean(item?.highlight),
    }))
    .filter((item) => item.text);
};

const normalizeFeaturesByCycle = ({ featuresByCycle = null, features = null } = {}) => {
  const normalizedByCycle = {};

  FEATURE_CYCLE_KEYS.forEach((cycleKey) => {
    normalizedByCycle[cycleKey] = normalizeFeatureList(featuresByCycle?.[cycleKey]);
  });

  const hasCycleFeatures = FEATURE_CYCLE_KEYS.some((cycleKey) => normalizedByCycle[cycleKey].length > 0);
  const legacyFeatures = normalizeFeatureList(features);

  if (!hasCycleFeatures) {
    const fallback = legacyFeatures;
    FEATURE_CYCLE_KEYS.forEach((cycleKey) => {
      normalizedByCycle[cycleKey] = [...fallback];
    });
  } else {
    const seed =
      normalizedByCycle.monthly.length > 0
        ? normalizedByCycle.monthly
        : FEATURE_CYCLE_KEYS.map((cycleKey) => normalizedByCycle[cycleKey]).find((rows) => rows.length > 0) || [];
    FEATURE_CYCLE_KEYS.forEach((cycleKey) => {
      if (normalizedByCycle[cycleKey].length === 0) {
        normalizedByCycle[cycleKey] = [...seed];
      }
    });
  }

  const monthlyFeatures = normalizedByCycle.monthly.length
    ? normalizedByCycle.monthly
    : legacyFeatures;

  return {
    features: monthlyFeatures,
    featuresByCycle: normalizedByCycle,
  };
};

const normalizeLimits = (limits = {}) => {
  const normalized = {};

  LIMIT_NUMBER_FIELDS.forEach((field) => {
    const raw = limits?.[field];
    const parsed = Number(raw);
    normalized[field] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });

  LIMIT_BOOLEAN_FIELDS.forEach((field) => {
    normalized[field] = Boolean(limits?.[field]);
  });

  return normalized;
};

const normalizeLimitsByCycle = ({ limitsByCycle = null, limits = null } = {}) => {
  const normalizedByCycle = {};

  LIMIT_CYCLE_KEYS.forEach((cycleKey) => {
    normalizedByCycle[cycleKey] = normalizeLimits(limitsByCycle?.[cycleKey]);
  });

  const hasCycleLimits = LIMIT_CYCLE_KEYS.some((cycleKey) =>
    LIMIT_NUMBER_FIELDS.some((field) => normalizedByCycle[cycleKey][field] > 0)
      || LIMIT_BOOLEAN_FIELDS.some((field) => normalizedByCycle[cycleKey][field] === true)
  );

  const legacyLimits = normalizeLimits(limits);

  if (!hasCycleLimits) {
    LIMIT_CYCLE_KEYS.forEach((cycleKey) => {
      normalizedByCycle[cycleKey] = { ...legacyLimits };
    });
  }

  return {
    limits: { ...normalizedByCycle.monthly },
    limitsByCycle: normalizedByCycle,
  };
};

const hasLimitData = (limits = {}) =>
  LIMIT_NUMBER_FIELDS.some((field) => Number(limits?.[field] || 0) > 0)
  || LIMIT_BOOLEAN_FIELDS.some((field) => Boolean(limits?.[field]));

const attachLegacyPlanData = (plan) => {
  const normalized = plan?.toObject ? plan.toObject() : { ...(plan || {}) };
  const monthlyFeatures = normalizeFeatureList(normalized?.featuresByCycle?.monthly);
  const legacyFeatures = normalizeFeatureList(normalized?.features);
  const monthlyCycleLimits = normalizeLimits(normalized?.limitsByCycle?.monthly);
  const legacyLimits = normalizeLimits(normalized?.limits);
  const resolvedCycleLimits = normalized?.limitsByCycle || {
    monthly: legacyLimits,
    quarterly: legacyLimits,
    halfYearly: legacyLimits,
    yearly: legacyLimits,
  };

  return {
    ...normalized,
    features: legacyFeatures.length > 0 ? legacyFeatures : monthlyFeatures,
    featuresByCycle: normalized?.featuresByCycle || {
      monthly: legacyFeatures,
      quarterly: legacyFeatures,
      halfYearly: legacyFeatures,
      yearly: legacyFeatures,
    },
    limits: hasLimitData(legacyLimits) ? legacyLimits : monthlyCycleLimits,
    limitsByCycle: {
      monthly: monthlyCycleLimits,
      quarterly: normalizeLimits(resolvedCycleLimits?.quarterly),
      halfYearly: normalizeLimits(resolvedCycleLimits?.halfYearly),
      yearly: normalizeLimits(resolvedCycleLimits?.yearly),
    },
  };
};

const getRoleDocByName = async (roleName) => {
  const normalizedRoleName = normalizeRole(roleName);
  if (!normalizedRoleName) return null;
  return Role.findOne({ name: normalizedRoleName }).select('_id name').lean();
};

const getRoleDocById = async (roleId) => {
  if (!roleId) return null;
  return Role.findById(roleId).select('_id name').lean();
};

const getPlanForRoleAndSlug = async ({ roleRefId, slug }) => {
  if (!roleRefId) return null;
  return SubscriptionPlan.findOne({
    slug,
    isActive: true,
    targetRoleRef: roleRefId,
  });
};

const syncUnlockedRole = ({ user, roleDoc, slug = '', billingCycle = '' }) => {
  if (!user || !roleDoc?.name) return;
  const roleName = String(roleDoc.name || '').toLowerCase();
  const entries = Array.isArray(user.unlockedRoles) ? [...user.unlockedRoles] : [];
  const existingIndex = entries.findIndex((entry) => String(entry?.role || '').toLowerCase() === roleName);
  const payload = {
    role: roleName,
    roleRef: roleDoc._id || null,
    unlockedAt: new Date(),
    sourcePlanSlug: String(slug || '').toLowerCase(),
    billingCycle: String(billingCycle || ''),
    unlockFlag: 1,
  };
  if (existingIndex >= 0) entries[existingIndex] = { ...entries[existingIndex], ...payload };
  else entries.push(payload);
  user.unlockedRoles = entries;
};

const applySubscriptionToUser = ({ user, slug, billingCycle, targetRoleDoc, activateRole = false }) => {
  const now = new Date();
  const daysToAdd = getDaysForBillingCycle(billingCycle);
  const nextExpiry = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  user.subscriptionPlan = slug;
  user.subscriptionBillingCycle = billingCycle || 'monthly';
  user.paymentStatus = slug === 'free' ? 'none' : 'active';
  user.subscriptionExpiry = nextExpiry;

  if (slug !== 'trial' && slug !== 'free') {
    user.subscriptionPromptOpenCount = 0;
    user.subscriptionPromptLastShownAt = null;
  }

  if (targetRoleDoc?._id && targetRoleDoc?.name) {
    syncUnlockedRole({ user, roleDoc: targetRoleDoc, slug, billingCycle });
    if (activateRole) {
      user.role = targetRoleDoc.name;
      user.activeRole = targetRoleDoc.name;
      user.roleRef = targetRoleDoc._id;
      if (!user.baseRole) user.baseRole = 'player';
    }
  }

  return { now, nextExpiry };
};

const resolveTargetRoleForSubscription = async ({ user, roleId, roleName }) => {
  if (roleId) {
    const byId = await getRoleDocById(roleId);
    if (!byId || !SUBSCRIPTION_ELIGIBLE_ROLES.includes(byId.name)) return null;
    return byId;
  }
  const normalizedByName = normalizeRole(roleName);
  if (normalizedByName) {
    const byName = await getRoleDocByName(normalizedByName);
    if (!byName) return null;
    return byName;
  }
  const userRole = normalizeRole(user?.role);
  if (!SUBSCRIPTION_ELIGIBLE_ROLES.includes(userRole)) return null;
  return user?.roleRef ? getRoleDocById(user.roleRef) : getRoleDocByName(userRole);
};

const getSubscriptionChangeType = ({ previous = null, nextSlug = '', nextCycle = '' }) => {
  if (!previous) return 'new';
  if (String(previous.planSlug || '').toLowerCase() === String(nextSlug || '').toLowerCase()) {
    if (String(previous.billingCycle || '') === String(nextCycle || '')) return 'renewal';
    return 'cycle_change';
  }
  return 'plan_change';
};

const expireRoleSubscriptionsIfDue = async ({ userId, roleRefId, now = new Date() }) => {
  if (!userId || !roleRefId) return;
  await UserRoleSubscription.updateMany(
    {
      user: userId,
      roleRef: roleRefId,
      status: 'active',
      expiresAt: { $lte: now },
    },
    {
      $set: { status: 'expired', endedAt: now },
    }
  );
};

const writeUserRoleSubscriptionRecord = async ({
  user,
  roleDoc,
  plan,
  planSlug,
  billingCycle,
  amount = 0,
  currency = 'INR',
  startsAt,
  expiresAt,
  paymentId = null,
  status = 'active',
  changeType = 'new',
  previousSubscription = null,
  metadata = {},
  activatedAt = null,
}) => {
  if (!user?._id || !roleDoc?._id || !plan?._id || !startsAt || !expiresAt) return;
  return UserRoleSubscription.create({
    user: user._id,
    role: roleDoc.name,
    roleRef: roleDoc._id,
    plan: plan._id,
    planSlug: String(planSlug || '').toLowerCase(),
    billingCycle,
    amount: Number(amount || 0),
    currency: String(currency || 'INR').toUpperCase(),
    startsAt,
    expiresAt,
    status,
    changeType,
    activatedAt: activatedAt || (status === 'active' ? startsAt : null),
    previousSubscription: previousSubscription || null,
    payment: paymentId || null,
    metadata: metadata || {},
  });
};

const createOrQueueRoleSubscription = async ({
  user,
  roleDoc,
  plan,
  planSlug,
  billingCycle,
  amount = 0,
  currency = 'INR',
  paymentId = null,
  activateRole = true,
  academyName = '',
}) => {
  const now = new Date();
  const daysToAdd = getDaysForBillingCycle(billingCycle);

  await expireRoleSubscriptionsIfDue({ userId: user._id, roleRefId: roleDoc._id, now });

  const currentActive = await UserRoleSubscription.findOne({
    user: user._id,
    roleRef: roleDoc._id,
    status: 'active',
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: -1, createdAt: -1 })
    .lean();

  if (currentActive) {
    await UserRoleSubscription.updateMany(
      {
        user: user._id,
        roleRef: roleDoc._id,
        status: 'queued',
      },
      {
        $set: {
          status: 'superseded',
          endedAt: now,
          metadata: { replacedAt: now },
        },
      }
    );

    const startsAt = new Date(currentActive.expiresAt);
    const expiresAt = new Date(startsAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const queuedRecord = await writeUserRoleSubscriptionRecord({
      user,
      roleDoc,
      plan,
      planSlug,
      billingCycle,
      amount,
      currency,
      startsAt,
      expiresAt,
      paymentId,
      status: 'queued',
      changeType: getSubscriptionChangeType({
        previous: currentActive,
        nextSlug: planSlug,
        nextCycle: billingCycle,
      }),
      previousSubscription: currentActive?._id || null,
      metadata: { queueReason: 'active_subscription_exists' },
    });

    syncUnlockedRole({ user, roleDoc, slug: planSlug, billingCycle });
    if (roleDoc?.name === 'academyadmin') {
      await ensureAcademyProfileForUser({ user, academyName });
    }
    await user.save();

    return {
      mode: 'queued',
      now,
      startsAt,
      expiresAt,
      currentActive,
      queuedRecord,
    };
  }

  const { now: activatedAt, nextExpiry } = applySubscriptionToUser({
    user,
    slug: planSlug,
    billingCycle,
    targetRoleDoc: roleDoc,
    activateRole,
  });
  if (roleDoc?.name === 'academyadmin') {
    await ensureAcademyProfileForUser({ user, academyName });
  }
  await user.save();

  const immediateRecord = await writeUserRoleSubscriptionRecord({
    user,
    roleDoc,
    plan,
    planSlug,
    billingCycle,
    amount,
    currency,
    startsAt: activatedAt,
    expiresAt: nextExpiry,
    paymentId,
    status: 'active',
    changeType: 'new',
    activatedAt,
  });

  return {
    mode: 'active',
    now: activatedAt,
    startsAt: activatedAt,
    expiresAt: nextExpiry,
    currentActive: null,
    queuedRecord: null,
    immediateRecord,
  };
};

const ensureAcademyProfileForUser = async ({ user, academyName = '' }) => {
  if (!user?._id) return null;

  let academy = null;
  if (user.academyId) {
    academy = await SportsAcademy.findById(user.academyId);
  }
  if (!academy) {
    academy = await SportsAcademy.findOne({ adminUser: user._id });
  }

  if (academy) {
      const userPhone = String(user.phone || '').trim();
    const academyPhone = String(academy.phone || '').trim();
    const createdVia = String(academy?.metadata?.get?.('createdVia') || academy?.metadata?.createdVia || '');
    // Subscription unlock academies should be publicly listable (landing / browse); legacy rows may still be PENDING.
    if (createdVia === 'subscription_unlock' && academy.status === 'PENDING') {
      academy.status = 'APPROVED';
      if (!academy.approvedAt) academy.approvedAt = new Date();
    }
    // If academy was auto-created from unlock flow and still mirrors admin phone,
    // clear it so academy hub can capture its own dedicated contact number later.
    if (academyPhone && userPhone && academyPhone === userPhone && createdVia === 'subscription_unlock') {
      academy.phone = '';
    }
    if (!academy.adminUser || String(academy.adminUser) !== String(user._id)) {
      academy.adminUser = user._id;
    }
    if (academy.isModified()) await academy.save();
    if (!user.academyId || String(user.academyId) !== String(academy._id)) {
      user.academyId = academy._id;
    }
    return academy;
  }

  const normalizedName = normalizeAcademyName(academyName);
  if (!normalizedName) {
    const error = new Error('academyName is required to unlock academy admin role');
    error.statusCode = 400;
    throw error;
  }

  const userLabel = normalizeAcademyName(
    [String(user?.firstName || '').trim(), String(user?.lastName || '').trim()]
      .filter(Boolean)
      .join(' ')
  ) || normalizeAcademyName(String(user?.email || '').split('@')[0]) || `user-${String(user?._id || '').slice(-6)}`;

  const baseCandidate = normalizeAcademyName(normalizedName);
  const preferredCandidate = normalizeAcademyName(`${baseCandidate} - ${userLabel}`);
  const userIdCandidate = normalizeAcademyName(`${baseCandidate} - ${String(user?._id || '').slice(-6)}`);

  const initialCandidates = [...new Set([baseCandidate, preferredCandidate, userIdCandidate].filter(Boolean))];

  let resolvedName = '';
  for (const candidate of initialCandidates) {
    const existing = await SportsAcademy.findOne({ name: candidate }).select('_id adminUser').lean();
    if (!existing || String(existing.adminUser || '') === String(user._id)) {
      resolvedName = candidate;
      break;
    }
  }

  if (!resolvedName) {
    for (let i = 2; i <= 50; i += 1) {
      const numberedCandidate = normalizeAcademyName(`${preferredCandidate || baseCandidate} ${i}`);
      if (!numberedCandidate) continue;
      // eslint-disable-next-line no-await-in-loop
      const existing = await SportsAcademy.findOne({ name: numberedCandidate }).select('_id adminUser').lean();
      if (!existing || String(existing.adminUser || '') === String(user._id)) {
        resolvedName = numberedCandidate;
        break;
      }
    }
  }

  if (!resolvedName) {
    const error = new Error('Unable to allocate a unique academy name. Please try again with a different name.');
    error.statusCode = 409;
    throw error;
  }

  let created = null;
  try {
    created = await SportsAcademy.create({
      name: resolvedName,
      adminUser: user._id,
      // Keep academy contact empty by default; admin can set dedicated academy phone in hub.
      phone: '',
      status: 'APPROVED',
      approvedAt: new Date(),
      metadata: {
        createdVia: 'subscription_unlock',
        createdForRole: 'academyadmin',
      },
    });
  } catch (createError) {
    // Race-safe fallback for unique index collisions on academy name.
    if (createError?.code === 11000) {
      const retryName = normalizeAcademyName(`${preferredCandidate || baseCandidate} - ${Date.now().toString().slice(-5)}`);
      created = await SportsAcademy.create({
        name: retryName,
        adminUser: user._id,
        phone: '',
        status: 'APPROVED',
        approvedAt: new Date(),
        metadata: {
          createdVia: 'subscription_unlock',
          createdForRole: 'academyadmin',
        },
      });
    } else {
      throw createError;
    }
  }

  user.academyId = created._id;
  return created;
};

/**
 * @desc    Get all active subscription plans (public)
 * @route   GET /api/subscriptions/plans
 * @access  Public
 */
export const getPlans = async (req, res) => {
  try {
    const role = normalizeRole(req.query.role);
    const roleId = req.query.roleId;
    const query = { isActive: true };
    if (roleId) {
      query.targetRoleRef = roleId;
    } else if (role) {
      const roleDoc = await getRoleDocByName(role);
      if (!roleDoc) {
        return res.status(400).json({ success: false, message: `Role '${role}' not found` });
      }
      query.targetRoleRef = roleDoc._id;
    }

    const orderedPlans = await SubscriptionPlan.find(query)
      .populate('targetRoleRef', 'name displayName')
      .sort({ sortOrder: 1, name: 1 });

    const data = orderedPlans.map((plan) => attachLegacyPlanData(plan));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ success: false, message: 'Error fetching plans', error: error.message });
  }
};

/**
 * @desc    Get all plans for admin (active + inactive)
 * @route   GET /api/subscriptions/plans/admin
 * @access  Private (superadmin)
 */
export const getAdminPlans = async (req, res) => {
  try {
    const role = normalizeRole(req.query.role);
    const roleId = req.query.roleId;
    const query = {};
    if (roleId) {
      query.targetRoleRef = roleId;
    } else if (role) {
      const roleDoc = await getRoleDocByName(role);
      if (!roleDoc) {
        return res.status(400).json({ success: false, message: `Role '${role}' not found` });
      }
      query.targetRoleRef = roleDoc._id;
    }

    const plans = await SubscriptionPlan.find(query)
      .populate('targetRoleRef', 'name displayName')
      .populate('createdBy', 'firstName lastName email role')
      .populate('updatedBy', 'firstName lastName email role')
      .sort({ sortOrder: 1, createdAt: -1 });
    const data = plans.map((plan) => attachLegacyPlanData(plan));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Get admin plans error:', error);
    res.status(500).json({ success: false, message: 'Error fetching plans', error: error.message });
  }
};

/**
 * @desc    Get subscription-eligible roles for admin plan management
 * @route   GET /api/subscriptions/roles/admin
 * @access  Private (superadmin)
 */
export const getAdminSubscriptionRoles = async (req, res) => {
  try {
    const roles = await Role.find({
      name: { $in: SUBSCRIPTION_ELIGIBLE_ROLES },
    })
      .select('_id name displayName description')
      .sort({ displayName: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    console.error('Get admin subscription roles error:', error);
    res.status(500).json({ success: false, message: 'Error fetching subscription roles', error: error.message });
  }
};

/**
 * @desc    Get subscription-eligible roles for upgrade flow
 * @route   GET /api/subscriptions/roles
 * @access  Public
 */
export const getSubscriptionRoles = async (req, res) => {
  try {
    const roles = await Role.find({
      name: { $in: SUBSCRIPTION_ELIGIBLE_ROLES },
    })
      .select('_id name displayName')
      .sort({ displayName: 1, name: 1 })
      .lean();
    return res.status(200).json({ success: true, data: roles });
  } catch (error) {
    console.error('Get subscription roles error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching roles', error: error.message });
  }
};

/**
 * @desc    Get current user's role subscription history
 * @route   GET /api/subscriptions/history/me
 * @access  Private
 */
export const getMySubscriptionHistory = async (req, res) => {
  try {
    const roleId = req.query.roleId || '';
    const roleName = normalizeRole(req.query.role || '');
    const status = String(req.query.status || '').trim().toLowerCase();
    const allowedStatuses = ['queued', 'active', 'expired', 'cancelled', 'superseded'];

    const query = { user: req.user._id };
    if (roleId) query.roleRef = roleId;
    else if (roleName) query.role = roleName;
    if (status && allowedStatuses.includes(status)) query.status = status;

    const history = await UserRoleSubscription.find(query)
      .populate('roleRef', 'name displayName')
      .populate('plan', 'name slug targetRoleRef')
      .sort({ startsAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('Get my subscription history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching subscription history',
      error: error.message,
    });
  }
};

/**
 * @desc    Get users who have any subscription history (admin dropdown)
 * @route   GET /api/subscriptions/history/admin/users/options
 * @access  Private (superadmin)
 */
export const getAdminSubscriptionUsers = async (req, res) => {
  try {
    const q = String(req.query.q || '')
      .trim()
      .replace(/\s+/g, ' ');
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const queryTokens = q ? q.toLowerCase().split(' ').filter(Boolean) : [];

    const userSearchMatch = queryTokens.length
      ? {
          $and: queryTokens.map((token) => ({
            $or: [
              { 'user.firstName': { $regex: token, $options: 'i' } },
              { 'user.lastName': { $regex: token, $options: 'i' } },
              { 'user.email': { $regex: token, $options: 'i' } },
              { 'user.role': { $regex: token, $options: 'i' } },
              { 'user.activeRole': { $regex: token, $options: 'i' } },
              {
                $expr: {
                  $regexMatch: {
                    input: {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ['$user.firstName', ''] },
                            ' ',
                            { $ifNull: ['$user.lastName', ''] },
                          ],
                        },
                      },
                    },
                    regex: token,
                    options: 'i',
                  },
                },
              },
            ],
          })),
        }
      : null;

    const pipeline = [
      {
        $group: {
          _id: '$user',
          subscriptionCount: { $sum: 1 },
          lastSubscriptionAt: { $max: '$createdAt' },
        },
      },
      { $sort: { lastSubscriptionAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ];

    if (userSearchMatch) {
      pipeline.push({ $match: userSearchMatch });
    }

    pipeline.push(
      { $sort: { lastSubscriptionAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          email: '$user.email',
          role: '$user.role',
          activeRole: '$user.activeRole',
          subscriptionCount: 1,
          lastSubscriptionAt: 1,
        },
      }
    );

    const data = await UserRoleSubscription.aggregate(pipeline);
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Get admin subscription users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching subscription users',
      error: error.message,
    });
  }
};

/**
 * @desc    Get any user's role subscription history (admin)
 * @route   GET /api/subscriptions/history/admin/users/:userId
 * @access  Private (superadmin)
 */
export const getUserSubscriptionHistoryAdmin = async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    const roleId = String(req.query.roleId || '').trim();
    const roleName = normalizeRole(req.query.role || '');
    const status = String(req.query.status || '').trim().toLowerCase();
    const allowedStatuses = ['queued', 'active', 'expired', 'cancelled', 'superseded'];

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const userExists = await User.findById(userId).select('_id firstName lastName email role activeRole').lean();
    if (!userExists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const query = { user: userId };
    if (roleId) query.roleRef = roleId;
    else if (roleName) query.role = roleName;
    if (status && allowedStatuses.includes(status)) query.status = status;

    const [total, history] = await Promise.all([
      UserRoleSubscription.countDocuments(query),
      UserRoleSubscription.find(query)
        .populate('user', 'firstName lastName email role activeRole')
        .populate('roleRef', 'name displayName')
        .populate('plan', 'name slug targetRoleRef')
        .populate('payment', 'paymentType amount currency status transactionId paidAt createdAt')
        .sort({ startsAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Backfill-friendly payment resolver for older records without direct payment reference.
    const historyWithPaymentFallback = await Promise.all(
      history.map(async (entry) => {
        if (entry?.payment || Number(entry?.amount || 0) <= 0) return entry;
        const startsAt = entry?.startsAt ? new Date(entry.startsAt) : null;
        const from = startsAt ? new Date(startsAt.getTime() - 10 * 60 * 1000) : null;
        const to = startsAt ? new Date(startsAt.getTime() + 10 * 60 * 1000) : null;

        const fallbackPayment = await Payment.findOne({
          user: userId,
          $or: [
            { 'metadata.subscriptionRecordId': entry._id },
            {
              'metadata.planSlug': entry.planSlug,
              'metadata.billingCycle': entry.billingCycle,
              ...(from && to ? { createdAt: { $gte: from, $lte: to } } : {}),
            },
            {
              'metadata.planSlug': entry.planSlug,
              'metadata.billingCycle': entry.billingCycle,
              ...(from && to ? { paidAt: { $gte: from, $lte: to } } : {}),
            },
          ],
        })
          .select('paymentType amount currency status transactionId paidAt createdAt')
          .sort({ paidAt: -1, createdAt: -1 })
          .lean();

        if (!fallbackPayment) return entry;
        return {
          ...entry,
          payment: fallbackPayment,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: historyWithPaymentFallback.length,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data: historyWithPaymentFallback,
      meta: {
        user: userExists,
        filters: {
          roleId: roleId || null,
          role: roleName || null,
          status: status || null,
        },
      },
    });
  } catch (error) {
    console.error('Get user subscription history admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user subscription history',
      error: error.message,
    });
  }
};

/**
 * @desc    Get subscription slug options for admin
 * @route   GET /api/subscriptions/slugs/admin
 * @access  Private (superadmin)
 */
export const getAdminSubscriptionSlugs = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const query = includeInactive ? {} : { isActive: true };
    const options = await SubscriptionSlug.find(query)
      .select('_id slug label isActive sortOrder createdAt updatedAt')
      .sort({ sortOrder: 1, label: 1, slug: 1 });

    res.status(200).json({
      success: true,
      count: options.length,
      data: options,
    });
  } catch (error) {
    console.error('Get admin subscription slugs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching subscription slugs', error: error.message });
  }
};

/**
 * @desc    Create or activate subscription slug option
 * @route   POST /api/subscriptions/slugs/admin
 * @access  Private (superadmin)
 */
export const createAdminSubscriptionSlug = async (req, res) => {
  try {
    const slug = normalizeSlug(req.body?.slug);
    const label = String(req.body?.label || '').trim();
    const sortOrder = Number(req.body?.sortOrder || 0);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'slug is required (letters, numbers, and hyphens only)',
      });
    }

    const existing = await SubscriptionSlug.findOne({ slug });
    if (existing) {
      existing.label = label || existing.label || toSlugLabel(slug);
      existing.isActive = true;
      existing.sortOrder = Number.isFinite(sortOrder) ? sortOrder : existing.sortOrder;
      existing.updatedBy = req.user?._id || null;
      await existing.save();
      return res.status(200).json({
        success: true,
        message: 'Slug option updated successfully',
        data: existing,
      });
    }

    const created = await SubscriptionSlug.create({
      slug,
      label: label || toSlugLabel(slug),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive: true,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Slug option created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Create admin subscription slug error:', error);
    res.status(500).json({ success: false, message: 'Error creating subscription slug', error: error.message });
  }
};

/**
 * @desc    Soft delete (deactivate) subscription slug option
 * @route   PATCH /api/subscriptions/slugs/admin/:slug/deactivate
 * @access  Private (superadmin)
 */
export const deactivateAdminSubscriptionSlug = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params?.slug);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slug',
      });
    }

    const inUse = await SubscriptionPlan.exists({ slug });
    if (inUse) {
      return res.status(409).json({
        success: false,
        code: 'SLUG_IN_USE',
        message: `Slug '${slug}' is in use by existing plans and cannot be deactivated`,
      });
    }

    const option = await SubscriptionSlug.findOne({ slug });
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Slug option not found',
      });
    }

    option.isActive = false;
    option.updatedBy = req.user?._id || null;
    await option.save();

    return res.status(200).json({
      success: true,
      message: 'Slug option deactivated successfully',
      data: option,
    });
  } catch (error) {
    console.error('Deactivate admin subscription slug error:', error);
    res.status(500).json({ success: false, message: 'Error deactivating subscription slug', error: error.message });
  }
};

/**
 * @desc    Create a subscription plan
 * @route   POST /api/subscriptions/plans
 * @access  Private (superadmin)
 */
export const createPlan = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.slug = normalizeSlug(payload.slug);
    payload.createdBy = req.user?._id || null;
    payload.updatedBy = req.user?._id || null;
    delete payload.createdAt;
    delete payload.updatedAt;
    const normalizedFeatures = normalizeFeaturesByCycle({
      featuresByCycle: payload.featuresByCycle,
      features: payload.features,
    });
    const normalizedLimits = normalizeLimitsByCycle({
      limitsByCycle: payload.limitsByCycle,
      limits: payload.limits,
    });
    payload.features = normalizedFeatures.features;
    payload.featuresByCycle = normalizedFeatures.featuresByCycle;
    payload.limits = normalizedLimits.limits;
    payload.limitsByCycle = normalizedLimits.limitsByCycle;

    if (!payload.name || !payload.slug || !payload.targetRoleRef) {
      return res.status(400).json({ success: false, message: 'name, slug and targetRoleRef are required' });
    }

    const roleDoc = await getRoleDocById(payload.targetRoleRef);
    if (!roleDoc || !SUBSCRIPTION_ELIGIBLE_ROLES.includes(roleDoc.name)) {
      return res.status(400).json({ success: false, message: 'targetRoleRef must map to coach, academyadmin or organizer role' });
    }

    const existing = await SubscriptionPlan.findOne({ slug: payload.slug, targetRoleRef: payload.targetRoleRef });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A plan with slug '${payload.slug}' already exists for that role`,
      });
    }

    const plan = await SubscriptionPlan.create(payload);
    await upsertSubscriptionSlug({
      slug: payload.slug,
      actorId: req.user?._id || null,
    });
    res.status(201).json({ success: true, message: 'Plan created successfully', data: plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ success: false, message: 'Error creating plan', error: error.message });
  }
};

/**
 * @desc    Update a subscription plan
 * @route   PUT /api/subscriptions/plans/:id
 * @access  Private (superadmin)
 */
export const updatePlan = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.slug !== undefined) {
      updates.slug = normalizeSlug(updates.slug);
      if (!updates.slug) {
        return res.status(400).json({ success: false, message: 'Invalid slug format' });
    }
      }
    if (updates.targetRoleRef !== undefined) {
      const roleDoc = await getRoleDocById(updates.targetRoleRef);
      if (!roleDoc || !SUBSCRIPTION_ELIGIBLE_ROLES.includes(roleDoc.name)) {
        return res.status(400).json({ success: false, message: 'Invalid targetRoleRef' });
    }
    }
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (updates.featuresByCycle !== undefined || updates.features !== undefined) {
      const normalizedFeatures = normalizeFeaturesByCycle({
        featuresByCycle: updates.featuresByCycle,
        features: updates.features,
      });
      updates.features = normalizedFeatures.features;
      updates.featuresByCycle = normalizedFeatures.featuresByCycle;
    }
    if (updates.limitsByCycle !== undefined || updates.limits !== undefined) {
      const normalizedLimits = normalizeLimitsByCycle({
        limitsByCycle: updates.limitsByCycle,
        limits: updates.limits,
      });
      updates.limits = normalizedLimits.limits;
      updates.limitsByCycle = normalizedLimits.limitsByCycle;
    }

    const nextSlug = updates.slug ?? plan.slug;
    const nextRoleRef = updates.targetRoleRef ?? plan.targetRoleRef;
    const duplicate = await SubscriptionPlan.findOne({
      _id: { $ne: plan._id },
      slug: nextSlug,
      targetRoleRef: nextRoleRef,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Another plan with slug '${nextSlug}' already exists for that role`,
      });
    }

    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(plan._id, {
      ...updates,
      updatedBy: req.user?._id || null,
    }, {
      new: true,
      runValidators: true,
    });

    if (updates.slug !== undefined) {
      await upsertSubscriptionSlug({
        slug: updates.slug,
        actorId: req.user?._id || null,
      });
    }

    res.status(200).json({ success: true, message: 'Plan updated successfully', data: updatedPlan });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ success: false, message: 'Error updating plan', error: error.message });
  }
};

/**
 * @desc    Toggle plan active status
 * @route   PATCH /api/subscriptions/plans/:id/status
 * @access  Private (superadmin)
 */
export const togglePlanStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be boolean' });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { isActive, updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    res.status(200).json({
      success: true,
      message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: plan,
    });
  } catch (error) {
    console.error('Toggle plan status error:', error);
    res.status(500).json({ success: false, message: 'Error updating plan status', error: error.message });
  }
};

/**
 * @desc    Get a single plan by slug
 * @route   GET /api/subscriptions/plans/:slug
 * @access  Public
 */
export const getPlanBySlug = async (req, res) => {
  try {
    const role = normalizeRole(req.query.role);
    const roleId = req.query.roleId;
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const query = { slug, isActive: true };
    if (roleId) {
      query.targetRoleRef = roleId;
    } else if (role) {
      const roleDoc = await getRoleDocByName(role);
      if (!roleDoc) {
        return res.status(400).json({ success: false, message: `Role '${role}' not found` });
      }
      query.targetRoleRef = roleDoc._id;
    }

    const plan = await SubscriptionPlan.findOne(query).populate('targetRoleRef', 'name displayName');
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.status(200).json({ success: true, data: attachLegacyPlanData(plan) });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ success: false, message: 'Error fetching plan', error: error.message });
  }
};

/**
 * @desc    Seed default subscription plans
 * @route   POST /api/subscriptions/seed
 * @access  Private (superadmin)
 */
export const seedPlans = async (req, res) => {
  try {
    const overwrite = Boolean(req.body?.overwrite);
    await seedSubscriptionSlugs({ actorId: req.user?._id || null });
    const result = await seedSubscriptionPlans({ overwrite, actorId: req.user?._id || null });
    res.status(200).json({
      success: true,
      message: overwrite
        ? "Plans seeded with overwrite successfully"
        : "Plans seeded successfully (missing plans inserted only)",
      ...result,
    });
  } catch (error) {
    console.error('Seed plans error:', error);
    const duplicateIndexConflict =
      error?.code === 11000 &&
      (String(error?.message || '').includes('slug_1') || String(error?.message || '').includes('dup key'));

    if (duplicateIndexConflict) {
      return res.status(500).json({
        success: false,
        code: 'SUBSCRIPTION_INDEX_CONFLICT',
        message:
          'Seed failed due to old index shape. Ensure unique index is (slug + targetRoleRef).',
        error: error.message,
        hint: {
          collection: 'subscriptionplans',
          expectedUniqueIndex: { slug: 1, targetRoleRef: 1 },
        },
      });
    }

    res.status(500).json({ success: false, message: 'Error seeding plans', error: error.message });
  }
};

/**
 * @desc    Activate (dummy pay) subscription for current user
 * @route   POST /api/subscriptions/activate
 * @access  Private (academyadmin/coach/organizer)
 */
export const activateSubscription = async (req, res) => {
  try {
    const {
      planSlug,
      billingCycle = 'monthly',
      targetRoleRef = '',
      roleId = '',
      targetRole = '',
      role = '',
      academyName = '',
    } = req.body;
    const normalizedCycle = normalizeBillingCycle(billingCycle);
    const slug = String(planSlug || '').toLowerCase();

    if (!slug) {
      return res.status(400).json({ success: false, message: 'planSlug is required' });
    }
    if (!normalizedCycle) {
      return res.status(400).json({
        success: false,
        message: `billingCycle must be one of: ${SUPPORTED_BILLING_CYCLES.join(', ')}`,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const roleDoc = await resolveTargetRoleForSubscription({
      user,
      roleId: targetRoleRef || roleId,
      roleName: targetRole || role,
    });
    if (!roleDoc) {
      return res.status(400).json({
        success: false,
        message: 'Valid target role is required (coach, academyadmin, organizer)',
      });
    }
    const normalizedAcademyName = normalizeAcademyName(academyName);
    if (roleDoc.name === 'academyadmin') {
      const hasAcademyLink = Boolean(user?.academyId);
      const existingAcademy = hasAcademyLink
        ? await SportsAcademy.findById(user.academyId).select('_id').lean()
        : await SportsAcademy.findOne({ adminUser: user._id }).select('_id').lean();
      if (!existingAcademy && !normalizedAcademyName) {
        return res.status(400).json({
          success: false,
          code: 'ACADEMY_NAME_REQUIRED',
          message: 'academyName is required to unlock academy admin role',
        });
      }
    }

    const plan = await getPlanForRoleAndSlug({ roleRefId: roleDoc._id, slug });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Plan '${slug}' is not available for role '${roleDoc.name}'`,
      });
    }

    const amount = getAmountForBillingCycle(plan?.price, normalizedCycle);
    const currency = String(plan?.price?.currency || 'INR').toUpperCase();

    // Enforce dummy payment flow only for organizer paid plans.
    if (amount > 0 && roleDoc.name === 'organizer') {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_CONFIRMATION_REQUIRED',
        message: 'Paid subscription requires payment confirmation. Use /subscriptions/payment-intent and /subscriptions/payment-confirm/:paymentId',
      });
    }

    const lifecycle = await createOrQueueRoleSubscription({
      user,
      roleDoc,
      plan,
      planSlug: slug,
      billingCycle: normalizedCycle,
      amount,
      currency,
      activateRole: true,
      academyName: normalizedAcademyName,
    });

    let paymentRecord = null;
    // Keep a billing record for paid plan activations.
    if (amount > 0) {
      paymentRecord = await Payment.create({
        user: user._id,
        paymentType: getPaymentTypeByRole(roleDoc.name),
        amount,
        platformFee: amount,
        currency,
        status: 'completed',
        paymentMethod: 'other',
        transactionId: `SUB-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: `${plan.name} subscription (${normalizedCycle}) for ${roleDoc.name}`,
        metadata: {
          planSlug: slug,
          planId: plan._id,
          billingCycle: normalizedCycle,
          targetRoleRef: plan.targetRoleRef,
          targetRoleName: roleDoc.name,
          subscriptionLifecycleMode: lifecycle.mode,
          startsAt: lifecycle.startsAt,
          expiresAt: lifecycle.expiresAt,
        },
        paidAt: lifecycle.now,
      });
    }

    const linkedSubscriptionRecordId =
      lifecycle?.queuedRecord?._id || lifecycle?.immediateRecord?._id || null;
    if (paymentRecord?._id && linkedSubscriptionRecordId) {
      await UserRoleSubscription.findByIdAndUpdate(linkedSubscriptionRecordId, {
        payment: paymentRecord._id,
      });
      paymentRecord.metadata = {
        ...(paymentRecord.metadata || {}),
        subscriptionRecordId: linkedSubscriptionRecordId,
      };
      await paymentRecord.save();
    }

    return res.status(200).json({
      success: true,
      message:
        lifecycle.mode === 'queued'
          ? 'Subscription queued successfully. Current plan remains active until expiry.'
          : 'Subscription activated successfully',
      data: {
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        paymentStatus: user.paymentStatus,
        subscriptionPromptOpenCount: user.subscriptionPromptOpenCount || 0,
        subscriptionPromptLastShownAt: user.subscriptionPromptLastShownAt || null,
        billingCycle: normalizedCycle,
        activeRole: user.activeRole || user.role,
        unlockedRoles: user.unlockedRoles || [],
        subscriptionStatus: lifecycle.mode,
        startsAt: lifecycle.startsAt,
        expiresAt: lifecycle.expiresAt,
        currentSubscriptionExpiresAt: lifecycle?.currentActive?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Activate subscription error:', error);
    res.status(500).json({ success: false, message: 'Error activating subscription', error: error.message });
  }
};

/**
 * @desc    Create subscription dummy payment intent
 * @route   POST /api/subscriptions/payment-intent
 * @access  Private (academyadmin/coach/organizer)
 */
export const createSubscriptionPaymentIntent = async (req, res) => {
  try {
    const {
      planSlug,
      billingCycle = 'monthly',
      paymentMethod = 'card',
      targetRoleRef = '',
      roleId = '',
      targetRole = '',
      role = '',
      academyName = '',
    } = req.body;
    const normalizedCycle = normalizeBillingCycle(billingCycle);
    const slug = String(planSlug || '').toLowerCase();

    if (!slug) {
      return res.status(400).json({ success: false, message: 'planSlug is required' });
    }
    if (!normalizedCycle) {
      return res.status(400).json({
        success: false,
        message: `billingCycle must be one of: ${SUPPORTED_BILLING_CYCLES.join(', ')}`,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const roleDoc = await resolveTargetRoleForSubscription({
      user,
      roleId: targetRoleRef || roleId,
      roleName: targetRole || role,
    });
    if (!roleDoc) {
      return res.status(400).json({
        success: false,
        message: 'Valid target role is required (coach, academyadmin, organizer)',
      });
    }
    const normalizedAcademyName = normalizeAcademyName(academyName);
    if (roleDoc.name === 'academyadmin') {
      const hasAcademyLink = Boolean(user?.academyId);
      const existingAcademy = hasAcademyLink
        ? await SportsAcademy.findById(user.academyId).select('_id').lean()
        : await SportsAcademy.findOne({ adminUser: user._id }).select('_id').lean();
      if (!existingAcademy && !normalizedAcademyName) {
        return res.status(400).json({
          success: false,
          code: 'ACADEMY_NAME_REQUIRED',
          message: 'academyName is required to unlock academy admin role',
        });
      }
    }

    const plan = await getPlanForRoleAndSlug({ roleRefId: roleDoc._id, slug });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Plan '${slug}' is not available for role '${roleDoc.name}'`,
      });
    }

    const amount = getAmountForBillingCycle(plan?.price, normalizedCycle);
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected plan has invalid amount for this billing cycle',
      });
    }

    const currency = String(plan?.price?.currency || 'INR').toUpperCase();
    const payment = await Payment.create({
      user: user._id,
      paymentType: getPaymentTypeByRole(roleDoc.name),
      amount,
      platformFee: amount,
      currency,
      status: 'pending',
      paymentMethod: normalizePaymentMethod(paymentMethod),
      description: `${plan.name} subscription (${normalizedCycle}) for ${roleDoc.name}`,
      metadata: {
        flow: 'subscription_dummy',
        planSlug: slug,
        planId: plan._id,
        billingCycle: normalizedCycle,
        targetRoleRef: plan.targetRoleRef,
        targetRoleName: roleDoc.name,
        academyName: normalizedAcademyName || undefined,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Subscription payment initiated',
      data: {
        paymentId: payment._id,
        amount,
        currency,
        billingCycle: normalizedCycle,
        planSlug: slug,
        planName: plan.name,
        targetRole: roleDoc.name,
      },
    });
  } catch (error) {
    console.error('Create subscription payment intent error:', error);
    res.status(500).json({ success: false, message: 'Error initiating subscription payment', error: error.message });
  }
};

/**
 * @desc    Confirm subscription dummy payment and activate plan
 * @route   POST /api/subscriptions/payment-confirm/:paymentId
 * @access  Private (academyadmin/coach/organizer)
 */
export const confirmSubscriptionPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentMethod = 'card', transactionId, paymentGateway = 'DUMMY_GATEWAY', paymentResponse = {} } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      user: user._id,
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    if (!['pending', 'processing'].includes(String(payment.status || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Payment is not in a confirmable state' });
    }

    const slug = String(payment?.metadata?.planSlug || '').toLowerCase();
    const normalizedCycle = normalizeBillingCycle(payment?.metadata?.billingCycle);
    const targetRoleRef = payment?.metadata?.targetRoleRef || null;
    const targetRoleName = normalizeRole(payment?.metadata?.targetRoleName || '');
    const academyName = normalizeAcademyName(payment?.metadata?.academyName || '');
    const roleDoc = await resolveTargetRoleForSubscription({
      user,
      roleId: targetRoleRef,
      roleName: targetRoleName,
    });
    if (!slug || !normalizedCycle) {
      return res.status(400).json({ success: false, message: 'Payment metadata is invalid for subscription activation' });
    }
    if (!roleDoc) {
      return res.status(400).json({ success: false, message: 'Payment metadata role is invalid' });
    }

    const plan = await getPlanForRoleAndSlug({ roleRefId: roleDoc._id, slug });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Plan '${slug}' is not available for role '${roleDoc.name}'`,
      });
    }

    const expectedAmount = getAmountForBillingCycle(plan?.price, normalizedCycle);
    if (Number(payment.amount || 0) !== Number(expectedAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch for selected subscription plan',
      });
    }

    const lifecycle = await createOrQueueRoleSubscription({
      user,
      roleDoc,
      plan,
      planSlug: slug,
      billingCycle: normalizedCycle,
      amount: payment.amount || expectedAmount,
      currency: payment.currency || 'INR',
      paymentId: payment._id,
      activateRole: true,
      academyName,
    });

    const fallbackTxn = `SUB-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    payment.status = 'completed';
    payment.platformFee = Number(payment.amount || 0);
    payment.paymentMethod = normalizePaymentMethod(paymentMethod);
    payment.transactionId = String(transactionId || fallbackTxn);
    payment.paidAt = lifecycle.now;
    payment.metadata = {
      ...(payment.metadata || {}),
      paymentGateway,
      paymentResponse,
      confirmedAt: lifecycle.now,
      subscriptionLifecycleMode: lifecycle.mode,
      startsAt: lifecycle.startsAt,
      expiresAt: lifecycle.expiresAt,
    };
    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        lifecycle.mode === 'queued'
          ? 'Payment confirmed. New subscription is queued and will start after current expiry.'
          : 'Subscription payment confirmed and plan activated',
      data: {
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        paymentStatus: user.paymentStatus,
        subscriptionPromptOpenCount: user.subscriptionPromptOpenCount || 0,
        subscriptionPromptLastShownAt: user.subscriptionPromptLastShownAt || null,
        billingCycle: normalizedCycle,
        paymentId: payment._id,
        transactionId: payment.transactionId,
        activeRole: user.activeRole || user.role,
        unlockedRoles: user.unlockedRoles || [],
        subscriptionStatus: lifecycle.mode,
        startsAt: lifecycle.startsAt,
        expiresAt: lifecycle.expiresAt,
        currentSubscriptionExpiresAt: lifecycle?.currentActive?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Confirm subscription payment error:', error);
    res.status(500).json({ success: false, message: 'Error confirming subscription payment', error: error.message });
  }
};
