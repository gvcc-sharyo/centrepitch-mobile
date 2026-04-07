import SubscriptionPlan from "../models/SubscriptionPlan.js";
import Role from "../models/Role.js";

export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: "Coach Pro",
    slug: "basic",
    targetRole: "coach",
    description: "For individual coaches growing private training business",
    tagline: "Grow your coaching profile",
    price: { monthly: 699, quarterly: 1999, halfYearly: 3799, yearly: 6999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Premium coach profile", included: true },
      { text: "Up to 60 active students", included: true },
      { text: "Session scheduling tools", included: true },
      { text: "Analytics dashboard", included: true, highlight: true },
      { text: "Priority email support", included: true },
      { text: "Advanced report exports", included: false },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 60,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 500,
      analytics: true,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
    },
    isPopular: true,
    badge: "Coach Popular",
    sortOrder: 101,
    isActive: true,
  },
  {
    name: "Coach Elite",
    slug: "premium",
    targetRole: "coach",
    description: "For top-tier coaches managing larger training programs",
    tagline: "Scale your coaching brand",
    price: { monthly: 1499, quarterly: 4199, halfYearly: 7999, yearly: 14999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Unlimited active students", included: true, highlight: true },
      { text: "Advanced profile branding", included: true, highlight: true },
      { text: "Priority listing in discovery", included: true },
      { text: "Advanced analytics & reports", included: true },
      { text: "Priority phone support", included: true, highlight: true },
      { text: "API access", included: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 2000,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "Coach Best Value",
    sortOrder: 102,
    isActive: true,
  },
  {
    name: "Coach Enterprise",
    slug: "enterprise",
    targetRole: "coach",
    description: "Custom setup for high-volume coaching organizations",
    tagline: "Tailored for elite coaching businesses",
    price: { monthly: 2499, quarterly: 6999, halfYearly: 13299, yearly: 24999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Everything in Coach Elite", included: true },
      { text: "Custom onboarding", included: true },
      { text: "Dedicated account manager", included: true, highlight: true },
      { text: "Custom integrations", included: true },
      { text: "White-label capabilities", included: true, highlight: true },
      { text: "24/7 support", included: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 0,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "",
    sortOrder: 103,
    isActive: true,
  },
  {
    name: "Academy Pro",
    slug: "basic",
    targetRole: "academyadmin",
    description: "For growing sports academies",
    tagline: "Run your academy smoothly",
    price: { monthly: 1999, quarterly: 5699, halfYearly: 10799, yearly: 19999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Up to 5 courts", included: true },
      { text: "Up to 15 coaches", included: true },
      { text: "Advanced booking management", included: true },
      { text: "Revenue dashboard", included: true, highlight: true },
      { text: "Priority email support", included: true },
    ],
    limits: {
      maxTeams: 10,
      maxPlayers: 300,
      maxCourts: 5,
      maxEvents: 20,
      maxCoaches: 15,
      maxStorage: 1500,
      analytics: true,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
    },
    isPopular: true,
    badge: "Academy Popular",
    sortOrder: 201,
    isActive: true,
  },
  {
    name: "Academy Elite",
    slug: "premium",
    targetRole: "academyadmin",
    description: "For high-performing academies at scale",
    tagline: "Scale operations and revenue",
    price: { monthly: 3499, quarterly: 9999, halfYearly: 18999, yearly: 34999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Unlimited courts", included: true, highlight: true },
      { text: "Unlimited coaches", included: true, highlight: true },
      { text: "Advanced academy analytics", included: true },
      { text: "Custom branding", included: true },
      { text: "Priority support", included: true, highlight: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 5000,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "Academy Best Value",
    sortOrder: 202,
    isActive: true,
  },
  {
    name: "Academy Enterprise",
    slug: "enterprise",
    targetRole: "academyadmin",
    description: "Enterprise-grade controls for multi-location academies",
    tagline: "Custom academy infrastructure",
    price: { monthly: 4999, quarterly: 13999, halfYearly: 26999, yearly: 49999, currency: "INR" },
    yearlyDiscount: 15,
    features: [
      { text: "Everything in Academy Elite", included: true },
      { text: "Dedicated success manager", included: true, highlight: true },
      { text: "Custom integrations", included: true },
      { text: "SLA-backed support", included: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 0,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "",
    sortOrder: 203,
    isActive: true,
  },
  {
    name: "Organizer Pro",
    slug: "basic",
    targetRole: "organizer",
    description: "For regular event organizers",
    tagline: "Create and manage events professionally",
    price: { monthly: 999, quarterly: 2799, halfYearly: 5299, yearly: 9999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Up to 15 events / month", included: true },
      { text: "Ticketing and registration tools", included: true },
      { text: "Event analytics dashboard", included: true, highlight: true },
      { text: "Email support", included: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 15,
      maxCoaches: 0,
      maxStorage: 1000,
      analytics: true,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
    },
    isPopular: true,
    badge: "Organizer Popular",
    sortOrder: 301,
    isActive: true,
  },
  {
    name: "Organizer Elite",
    slug: "premium",
    targetRole: "organizer",
    description: "For high-frequency event organizers",
    tagline: "Scale your tournament business",
    price: { monthly: 1999, quarterly: 5699, halfYearly: 10799, yearly: 19999, currency: "INR" },
    yearlyDiscount: 17,
    features: [
      { text: "Unlimited events", included: true, highlight: true },
      { text: "Advanced audience insights", included: true },
      { text: "Priority discovery placement", included: true },
      { text: "Priority support", included: true, highlight: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 3000,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "Organizer Best Value",
    sortOrder: 302,
    isActive: true,
  },
  {
    name: "Organizer Enterprise",
    slug: "enterprise",
    targetRole: "organizer",
    description: "Custom platform setup for large organizers",
    tagline: "Enterprise-grade event operations",
    price: { monthly: 2999, quarterly: 8499, halfYearly: 15999, yearly: 29999, currency: "INR" },
    yearlyDiscount: 15,
    features: [
      { text: "Everything in Organizer Elite", included: true },
      { text: "Dedicated account manager", included: true, highlight: true },
      { text: "White-label event pages", included: true },
      { text: "SLA and 24/7 support", included: true },
    ],
    limits: {
      maxTeams: 0,
      maxPlayers: 0,
      maxCourts: 0,
      maxEvents: 0,
      maxCoaches: 0,
      maxStorage: 0,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
    },
    isPopular: false,
    badge: "",
    sortOrder: 303,
    isActive: true,
  },
];

const normalizeFeatureList = (list = []) =>
  (Array.isArray(list) ? list : [])
    .map((item) => ({
      text: String(item?.text || "").trim(),
      included: item?.included !== false,
      highlight: Boolean(item?.highlight),
    }))
    .filter((item) => item.text);

const LIMIT_NUMBER_FIELDS = ["maxTeams", "maxPlayers", "maxCourts", "maxEvents", "maxCoaches", "maxStorage"];
const LIMIT_BOOLEAN_FIELDS = ["analytics", "prioritySupport", "customBranding", "apiAccess"];

const normalizeLimits = (limits = {}) => {
  const normalized = {};
  LIMIT_NUMBER_FIELDS.forEach((field) => {
    const parsed = Number(limits?.[field]);
    normalized[field] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  LIMIT_BOOLEAN_FIELDS.forEach((field) => {
    normalized[field] = Boolean(limits?.[field]);
  });
  return normalized;
};

const buildFeaturesByCycle = (baseFeatures = []) => {
  const base = normalizeFeatureList(baseFeatures);
  return {
    monthly: [...base],
    quarterly: [
      ...base,
      { text: "Quarterly billing bonus", included: true, highlight: true },
    ],
    halfYearly: [
      ...base,
      { text: "Half-yearly priority onboarding support", included: true, highlight: true },
    ],
    yearly: [
      ...base,
      { text: "Yearly premium success support and roadmap access", included: true, highlight: true },
    ],
  };
};

const scaleNumberLimit = (value, multiplier) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.ceil(numeric * multiplier);
};

const scaleLimits = (baseLimits, multiplier) => {
  const scaled = {};
  LIMIT_NUMBER_FIELDS.forEach((field) => {
    scaled[field] = scaleNumberLimit(baseLimits[field], multiplier);
  });
  LIMIT_BOOLEAN_FIELDS.forEach((field) => {
    scaled[field] = Boolean(baseLimits[field]);
  });
  return scaled;
};

const buildLimitsByCycle = (baseLimits = {}) => {
  const monthly = normalizeLimits(baseLimits);
  return {
    monthly: { ...monthly },
    quarterly: scaleLimits(monthly, 1.25),
    halfYearly: scaleLimits(monthly, 1.5),
    yearly: scaleLimits(monthly, 2),
  };
};

export const seedSubscriptionPlans = async ({ overwrite = false, actorId = null } = {}) => {
  let created = 0;
  let updated = 0;

  const roleNames = Array.from(
    new Set(
      DEFAULT_SUBSCRIPTION_PLANS.map((plan) => String(plan.targetRole || "").trim().toLowerCase()).filter(Boolean)
    )
  );
  const roles = await Role.find({ name: { $in: roleNames } }).select("_id name").lean();
  const roleIdByName = new Map(roles.map((role) => [String(role.name), role._id]));

  // Migrate any legacy plans that still store role as string.
  for (const roleName of roleNames) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;
    await SubscriptionPlan.updateMany(
      { targetRole: roleName, targetRoleRef: { $exists: false } },
      { $set: { targetRoleRef: roleId }, $unset: { targetRole: "" } }
    );
  }

  // Migrate old plans that don't yet have featuresByCycle.
  const plansMissingCycleFeatures = await SubscriptionPlan.find({
    $or: [
      { featuresByCycle: { $exists: false } },
      { "featuresByCycle.monthly": { $exists: false } },
      { "featuresByCycle.quarterly": { $exists: false } },
      { "featuresByCycle.halfYearly": { $exists: false } },
      { "featuresByCycle.yearly": { $exists: false } },
    ],
  }).select("_id features");

  for (const legacyPlan of plansMissingCycleFeatures) {
    const cycleFeatures = buildFeaturesByCycle(legacyPlan.features || []);
    await SubscriptionPlan.updateOne(
      { _id: legacyPlan._id },
      { $set: { featuresByCycle: cycleFeatures, features: cycleFeatures.monthly } }
    );
  }

  // Migrate old plans that don't yet have limitsByCycle.
  const plansMissingCycleLimits = await SubscriptionPlan.find({
    $or: [
      { limitsByCycle: { $exists: false } },
      { "limitsByCycle.monthly": { $exists: false } },
      { "limitsByCycle.quarterly": { $exists: false } },
      { "limitsByCycle.halfYearly": { $exists: false } },
      { "limitsByCycle.yearly": { $exists: false } },
    ],
  }).select("_id limits");

  for (const legacyPlan of plansMissingCycleLimits) {
    const cycleLimits = buildLimitsByCycle(legacyPlan.limits || {});
    await SubscriptionPlan.updateOne(
      { _id: legacyPlan._id },
      { $set: { limitsByCycle: cycleLimits, limits: cycleLimits.monthly } }
    );
  }

  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    const roleName = String(plan.targetRole || "").trim().toLowerCase();
    const roleId = roleIdByName.get(roleName);
    if (!roleId) {
      throw new Error(`Cannot seed plan '${plan.slug}': role '${roleName}' not found`);
    }

    const {
      targetRole: _legacyTargetRole,
      ...rest
    } = plan;

    const normalizedPlan = {
      ...rest,
      targetRoleRef: roleId,
      featuresByCycle: buildFeaturesByCycle(rest.features || []),
      features: normalizeFeatureList(rest.features || []),
      limitsByCycle: buildLimitsByCycle(rest.limits || {}),
      limits: normalizeLimits(rest.limits || {}),
    };

    const filter = { slug: plan.slug, targetRoleRef: roleId };
    if (overwrite) {
      const updatePayload = {
        ...normalizedPlan,
        updatedBy: actorId || null,
      };
      const result = await SubscriptionPlan.updateOne(
        filter,
        {
          $set: updatePayload,
          $setOnInsert: {
            createdBy: actorId || null,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      if (result.upsertedCount > 0) {
        created += 1;
      } else {
        updated += 1;
      }
      continue;
    }

    const result = await SubscriptionPlan.updateOne(
      filter,
      {
        $setOnInsert: {
          ...normalizedPlan,
          createdBy: actorId || null,
          updatedBy: actorId || null,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      created += 1;
    }
  }

  const roleIds = roles.map((role) => role._id);
  const plans = await SubscriptionPlan.find({
    targetRoleRef: { $in: roleIds },
  })
    .populate("targetRoleRef", "name displayName")
    .sort({ sortOrder: 1 });

  return {
    created,
    updated,
    total: plans.length,
    data: plans,
  };
};

