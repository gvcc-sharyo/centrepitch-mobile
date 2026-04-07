export const PLAN_ELIGIBLE_ROLES = ['coach', 'academyadmin', 'organizer'];
const TRIAL_DAYS = 7;
const PLAN_LABELS = {
  trial: 'Trial',
  basic: 'Basic',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const hasActivePaidPlan = (user) => {
  const plan = String(user?.subscriptionPlan || '').toLowerCase();
  const paidPlans = ['basic', 'premium', 'enterprise'];
  return paidPlans.includes(plan);
};

const isExpired = (user) => {
  if (!user?.subscriptionExpiry) return false;
  const expiry = new Date(user.subscriptionExpiry);
  return !Number.isNaN(expiry.getTime()) && new Date() > expiry;
};

const getEffectiveTrialExpiry = (user) => {
  const start = user?.trialStartDate ? new Date(user.trialStartDate) : null;
  const expiry = user?.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validExpiry = expiry && !Number.isNaN(expiry.getTime()) ? expiry : null;

  // Always cap trial duration to configured trial days for UI consistency.
  if (validStart) {
    const capped = new Date(validStart);
    capped.setDate(capped.getDate() + TRIAL_DAYS);
    if (validExpiry) {
      return validExpiry.getTime() < capped.getTime() ? validExpiry : capped;
    }
    return capped;
  }

  return validExpiry;
};

export const getSubscriptionTag = (user) => {
  const plan = String(user?.subscriptionPlan || 'free').toLowerCase();
  const expired = isExpired(user);
  const paymentStatus = String(user?.paymentStatus || '').toLowerCase();
  const paidActive = hasActivePaidPlan(user) && !expired && paymentStatus === 'active';

  if (plan === 'trial') {
    const trialExpiry = getEffectiveTrialExpiry(user);
    const isTrialExpired = trialExpiry ? new Date() > trialExpiry : false;
    return {
      label: isTrialExpired ? 'Trial Ended' : 'Trial',
      variant: isTrialExpired ? 'danger' : 'warning',
      paidActive: false,
      expired: isTrialExpired,
    };
  }

  if (paidActive) {
    return {
      label: 'Plan Activated',
      variant: 'success',
      paidActive: true,
      expired: false,
    };
  }

  if (hasActivePaidPlan(user) && expired) {
    return {
      label: 'Plan Expired',
      variant: 'danger',
      paidActive: false,
      expired: true,
    };
  }

  if (hasActivePaidPlan(user)) {
    return {
      label: 'Plan Pending',
      variant: 'warning',
      paidActive: false,
      expired: false,
    };
  }

  return {
    label: 'No Active Plan',
    variant: 'secondary',
    paidActive: false,
    expired: false,
  };
};

export const getPlanTypeLabel = (user) => {
  const plan = String(user?.subscriptionPlan || '').toLowerCase();
  return PLAN_LABELS[plan] || 'No Active Plan';
};

export const canShowUpgradeMenu = (user) =>
  PLAN_ELIGIBLE_ROLES.includes(String(user?.role || '').toLowerCase());

export const getTrialDaysLeft = (user) => {
  const plan = String(user?.subscriptionPlan || '').toLowerCase();
  if (plan !== 'trial') return null;
  const expiry = getEffectiveTrialExpiry(user);
  if (!expiry) return null;

  const msLeft = expiry.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
};

export const getPlanValidityDaysLeft = (user) => {
  if (!user?.subscriptionExpiry) return null;
  const expiry = new Date(user.subscriptionExpiry);
  if (Number.isNaN(expiry.getTime())) return null;
  const msLeft = expiry.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
};
