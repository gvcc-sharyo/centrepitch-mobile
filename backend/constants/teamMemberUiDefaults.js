/** Default team member roles / statuses for Sport.teamSettings and API fallbacks */

export const DEFAULT_TEAM_MEMBER_ROLES = [
  { value: "captain", label: "Captain", tone: "yellow", order: 0, leadership: true },
  { value: "vice_captain", label: "Vice Captain", tone: "amber", order: 1, leadership: true },
  { value: "player", label: "Player", tone: "blue", order: 2, leadership: false },
  { value: "substitute", label: "Substitute", tone: "gray", order: 3, leadership: false },
];

export const DEFAULT_TEAM_MEMBER_STATUSES = [
  { value: "active", label: "Active", tone: "emerald", order: 0 },
  { value: "inactive", label: "Inactive", tone: "gray", order: 1 },
  { value: "suspended", label: "Suspended", tone: "red", order: 2 },
  { value: "pending", label: "Pending", tone: "amber", order: 3 },
];

const ALLOWED_TONES = new Set([
  "yellow",
  "amber",
  "blue",
  "emerald",
  "gray",
  "red",
  "violet",
  "sky",
  "orange",
]);

const slugifyRoleValue = (raw, index) => {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s || `role_${index}`;
};

export const normalizeMemberRoleRow = (r, index = 0) => {
  const value = slugifyRoleValue(r?.value, index);
  const label = String(r?.label || value).trim() || value;
  const tone = ALLOWED_TONES.has(r?.tone) ? r.tone : "blue";
  const order = Number.isFinite(Number(r?.order)) ? Number(r.order) : index;
  const leadership =
    Boolean(r?.leadership) || value === "captain" || value === "vice_captain";
  return { value, label, tone, order, leadership };
};

export const normalizeMemberStatusRow = (r, index = 0) => {
  const value = slugifyRoleValue(r?.value, index);
  const label = String(r?.label || value).trim() || value;
  const tone = ALLOWED_TONES.has(r?.tone) ? r.tone : "emerald";
  const order = Number.isFinite(Number(r?.order)) ? Number(r.order) : index;
  return { value, label, tone, order };
};

export const buildMemberUiOptionsFromSport = (sportLean) => {
  const ts = sportLean?.teamSettings || {};
  const customRoles = Array.isArray(ts.memberRoles) ? ts.memberRoles : [];
  const customStatuses = Array.isArray(ts.memberStatuses) ? ts.memberStatuses : [];

  const roles =
    customRoles.length > 0
      ? customRoles
          .map((r, i) => normalizeMemberRoleRow(r, i))
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      : DEFAULT_TEAM_MEMBER_ROLES.map((r) => ({ ...r }));

  const statuses =
    customStatuses.length > 0
      ? customStatuses
          .map((r, i) => normalizeMemberStatusRow(r, i))
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      : DEFAULT_TEAM_MEMBER_STATUSES.map((s) => ({ ...s }));

  return { roles, statuses };
};
