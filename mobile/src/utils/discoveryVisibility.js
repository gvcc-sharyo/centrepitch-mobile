/** IDs for tying listings back to the logged-in account (coach.userId, academy.adminUser). */

export function normalizeDocId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && value !== null && value._id != null) {
    return String(value._id);
  }
  return String(value);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * While using the app as player, hide this user's own coach / academy admin listings
 * so they don't see themselves in discover flows after unlocking those roles.
 */
export function shouldHideOwnProfilesInDiscovery(isAuthenticated, user) {
  if (!isAuthenticated || !user) return false;
  const hasId = Boolean(normalizeDocId(user._id ?? user.id));
  const hasEmail = Boolean(normalizeEmail(user.email));
  if (!hasId && !hasEmail) return false;
  const active = String(user.activeRole || user.role || '').toLowerCase();
  return active === 'player';
}

/**
 * Public coach API omits `userId` for privacy — match by email (and id when present).
 * @param {Array} coaches
 * @param {object|null} user - full auth user (not only _id)
 */
export function excludeOwnCoachProfiles(coaches, user) {
  if (!Array.isArray(coaches)) return coaches || [];
  if (!user) return coaches;

  const uid = normalizeDocId(user._id ?? user.id);
  const uemail = normalizeEmail(user.email);

  if (!uid && !uemail) return coaches;

  return coaches.filter((c) => {
    if (uid) {
      const coachUid = normalizeDocId(c.userId ?? c.user);
      if (coachUid && coachUid === uid) return false;
    }
    if (uemail) {
      const coachEmail = normalizeEmail(c.email ?? c.user?.email);
      if (coachEmail && coachEmail === uemail) return false;
    }
    return true;
  });
}

/**
 * @param {Array} academies
 * @param {object|null} user
 */
export function excludeOwnAcademyProfiles(academies, user) {
  if (!Array.isArray(academies)) return academies || [];
  if (!user) return academies;

  const uid = normalizeDocId(user._id ?? user.id);
  const uemail = normalizeEmail(user.email);

  if (!uid && !uemail) return academies;

  return academies.filter((a) => {
    if (uid) {
      const adminId = normalizeDocId(a.adminUser);
      if (adminId && adminId === uid) return false;
    }
    if (uemail) {
      const academyEmail = normalizeEmail(a.email);
      if (academyEmail && academyEmail === uemail) return false;
    }
    return true;
  });
}
