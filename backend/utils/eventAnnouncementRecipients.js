import User from '../models/User.js';
import Team from '../models/Team.js';
import Staff from '../models/Staff.js';

/**
 * Collect unique User ids and email-only staff (no User account) for an event announcement.
 * @param {import('mongoose').Document} event - Event document (plain or mongoose doc)
 * @param {{ includeWithdrawn: boolean }} options
 * @returns {Promise<{ userIds: string[], emailOnlyRecipients: { email: string, name: string }[] }>}
 */
export async function collectEventAnnouncementRecipients(event, { includeWithdrawn }) {
  const userIdSet = new Set();
  const staffEmailCandidates = [];

  const isActiveRegistration = (status) =>
    includeWithdrawn || String(status || 'registered') !== 'withdrawn';

  const registeredPlayers = event.registeredPlayers || [];
  for (const rp of registeredPlayers) {
    if (!isActiveRegistration(rp.status)) continue;
    if (rp.player) userIdSet.add(String(rp.player));
    if (rp.partner) userIdSet.add(String(rp.partner));
  }

  const teamRegs = (event.registeredTeams || []).filter((tr) =>
    isActiveRegistration(tr.status)
  );
  const teamIds = teamRegs
    .map((tr) => (tr.team && tr.team._id ? tr.team._id : tr.team))
    .filter(Boolean);

  if (teamIds.length > 0) {
    const teams = await Team.find({ _id: { $in: teamIds } }).select(
      'captain viceCaptain members.player'
    );
    for (const team of teams) {
      if (team.captain) userIdSet.add(String(team.captain));
      if (team.viceCaptain) userIdSet.add(String(team.viceCaptain));
      for (const m of team.members || []) {
        if (m.player) userIdSet.add(String(m.player));
      }
    }
  }

  const staffMemberIdsToLoad = [];
  for (const s of event.staff || []) {
    if (s.user) {
      userIdSet.add(String(s.user));
      continue;
    }
    if (s.staffMember) staffMemberIdsToLoad.push(s.staffMember);
  }

  if (staffMemberIdsToLoad.length > 0) {
    const uniqueStaffIds = [...new Set(staffMemberIdsToLoad.map((id) => String(id)))];
    const staffDocs = await Staff.find({ _id: { $in: uniqueStaffIds } }).select(
      'linkedUserId email name'
    );
    const staffById = new Map(staffDocs.map((d) => [String(d._id), d]));

    for (const s of event.staff || []) {
      if (s.user || !s.staffMember) continue;
      const st = staffById.get(String(s.staffMember));
      if (!st) continue;
      if (st.linkedUserId) {
        userIdSet.add(String(st.linkedUserId));
      } else if (st.email) {
        staffEmailCandidates.push({
          email: String(st.email).trim().toLowerCase(),
          name: st.name || s.name || 'Staff'
        });
      }
    }
  }

  const emailOnlyRecipients = [];
  const seenEmails = new Set();
  for (const row of staffEmailCandidates) {
    if (!row.email || seenEmails.has(row.email)) continue;
    seenEmails.add(row.email);
    const u = await User.findOne({ email: row.email }).select('_id');
    if (u) {
      userIdSet.add(String(u._id));
    } else {
      emailOnlyRecipients.push(row);
    }
  }

  return {
    userIds: [...userIdSet],
    emailOnlyRecipients
  };
}
