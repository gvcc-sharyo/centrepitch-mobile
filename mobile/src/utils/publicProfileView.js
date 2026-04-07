/** Landing carousel → profile without Mongo id in the URL */

/**
 * Stable string id from API rows (_id / id / $oid / ObjectId) for /coaches/:id and /academies/:id links.
 */
export function publicEntityId(entity) {
  if (entity == null || typeof entity !== 'object') return '';
  const raw = entity._id ?? entity.id;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw).trim();
  if (typeof raw === 'object' && raw.$oid) return String(raw.$oid).trim();
  if (typeof raw === 'object' && typeof raw.toString === 'function') {
    const s = String(raw.toString()).trim();
    if (s && s !== '[object Object]') return s;
    }
  return '';
}

export const COACH_VIEW_PATH = '/coaches/view';
export const ACADEMY_VIEW_PATH = '/academies/view';

export const STORAGE_PENDING_COACH_ID = 'cp.pendingPublicCoachId';
export const STORAGE_PENDING_ACADEMY_ID = 'cp.pendingPublicAcademyId';

function normalizePathname(pathname) {
  return String(pathname || '').replace(/\/$/, '') || '/';
}

export function isCoachViewPath(pathname) {
  return normalizePathname(pathname) === COACH_VIEW_PATH;
}

export function isAcademyViewPath(pathname) {
  return normalizePathname(pathname) === ACADEMY_VIEW_PATH;
}

/**
 * @param {string | undefined} paramId - from /coaches/:id
 * @param {string} pathname
 * @param {{ coachId?: string } | null | undefined} locationState
 */
export function resolveCoachProfileId(paramId, pathname, locationState) {
  if (paramId) return paramId;
  if (!isCoachViewPath(pathname)) return null;
  try {
    return (
      locationState?.coachId ||
      sessionStorage.getItem(STORAGE_PENDING_COACH_ID) ||
      null
    );
  } catch {
    return locationState?.coachId || null;
  }
}

/**
 * @param {string | undefined} paramId - from /academies/:id
 * @param {string} pathname
 * @param {{ academyId?: string } | null | undefined} locationState
 */
export function resolveAcademyProfileId(paramId, pathname, locationState) {
  if (paramId) return paramId;
  if (!isAcademyViewPath(pathname)) return null;
  try {
    return (
      locationState?.academyId ||
      sessionStorage.getItem(STORAGE_PENDING_ACADEMY_ID) ||
      null
    );
  } catch {
    return locationState?.academyId || null;
  }
}
