import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import organizerService from "../../services/organizerService";
import teamService from "../../services/teamService";
import { selectUser } from "../../store/slices/authSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function refId(ref) {
  if (!ref) return "";
  if (typeof ref === "object" && ref._id) return String(ref._id);
  return String(ref);
}

function canManageTeam(team, user) {
  if (!team || !user?._id) return false;
  const uid = String(user._id);
  const cap = refId(team.captain);
  const cr = refId(team.createdBy);
  if (cap === uid || cr === uid) return true;
  if (String(user.role || "").toLowerCase() === "superadmin") return true;
  return false;
}

function normalizeMembers(team) {
  const raw = Array.isArray(team?.members) ? team.members : [];
  return raw.map((m) => {
    const p = m?.player;
    const name =
      m?.name ||
      (p && typeof p === "object"
        ? [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.email
        : "") ||
      "—";
    const email = m?.email || (p && typeof p === "object" ? p.email : "") || "";
    const phone = m?.phone || (p && typeof p === "object" ? p.phone : "") || "";
    const playerId = p && typeof p === "object" && p._id ? String(p._id) : typeof p === "string" ? p : "";
    return {
      _id: m?._id,
      playerId,
      name,
      email,
      phone,
      role: m?.role || "player",
      position: m?.position || "",
      jerseyNumber: m?.jerseyNumber ?? "",
      status: m?.status || "active",
    };
  });
}

function playerRowLabel(p) {
  const name = String(p?.name || "").trim();
  const email = String(p?.email || "").trim();
  if (name && email) return `${name} — ${email}`;
  return email || name || "Player";
}

const ROLE_OPTIONS = [
  { value: "captain", label: "Captain" },
  { value: "vice_captain", label: "Vice captain" },
  { value: "player", label: "Player" },
  { value: "substitute", label: "Substitute" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function OrganizerTeamPlayers() {
  const navigation = useNavigation();
  const route = useRoute();
  const user = useSelector(selectUser);
  const teamId = route.params?.teamId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteablePlayers, setInviteablePlayers] = useState([]);
  const [loadingInviteablePlayers, setLoadingInviteablePlayers] = useState(false);
  const [selectedInvitePlayerId, setSelectedInvitePlayerId] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviting, setInviting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [editForm, setEditForm] = useState({
    role: "player",
    position: "",
    jerseyNumber: "",
    status: "active",
  });

  const manage = canManageTeam(team, user);
  const captainUserId = refId(team?.captain);

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return null;
    }
    try {
      setLoading(true);
      const res = await teamService.getTeamById(String(teamId));
      const data = res?.data ?? res;
      setTeam(data);
      return data;
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load team");
      setTeam(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const members = useMemo(() => normalizeMembers(team), [team]);

  const memberEmailsAndUserIds = useCallback(
    (teamSnapshot) => {
      const emails = new Set();
      const userIds = new Set();
      for (const m of normalizeMembers(teamSnapshot)) {
        const em = String(m?.email || "").trim().toLowerCase();
        if (em) emails.add(em);
        if (m.playerId) userIds.add(String(m.playerId));
      }
      return { emails, userIds };
    },
    [],
  );

  const loadInviteablePlayers = useCallback(
    async (teamSnapshot = null) => {
      const activeTeam = teamSnapshot || team;
      const teamSportName = String(activeTeam?.sport?.name || activeTeam?.sportName || "").trim();
      if (!teamSportName) {
        setInviteablePlayers([]);
        return;
      }
      try {
        setLoadingInviteablePlayers(true);
        const res = await organizerService.getAvailablePlayers({
          limit: 500,
          sportsOnly: true,
          teamSportName,
          excludeIfInTeamSport: "1",
        });
        const all = Array.isArray(res?.data) ? res.data : [];

        const selectedGender = String(activeTeam?.genderCategory || "").toLowerCase();
        const genderFiltered = all.filter((p) => {
          const g = String(p?.gender || "").toLowerCase();
          if (selectedGender === "male") return !g || g === "male";
          if (selectedGender === "female") return !g || g === "female";
          return true;
        });

        const { emails: memberEmailsLower, userIds: memberUserIds } = memberEmailsAndUserIds(activeTeam);
        const filtered = genderFiltered.filter((p) => {
          const email = String(p?.email || "").trim().toLowerCase();
          const userId = String(p?._id || "").trim();
          if (!email) return false;
          if (memberEmailsLower.has(email)) return false;
          if (userId && memberUserIds.has(userId)) return false;
          return true;
        });

        setInviteablePlayers(filtered);
      } catch {
        setInviteablePlayers([]);
      } finally {
        setLoadingInviteablePlayers(false);
      }
    },
    [team, memberEmailsAndUserIds],
  );

  const openInvite = async () => {
    if (!teamId) return;
    setInviteOpen(true);
    setSelectedInvitePlayerId("");
    setInviteSearch("");
    const latest = (await load()) || team;
    await loadInviteablePlayers(latest || team);
  };

  const inviteSelectedPlayer = async () => {
    const selected = inviteablePlayers.find((p) => String(p?._id) === String(selectedInvitePlayerId));
    const email = String(selected?.email || "").trim().toLowerCase();
    if (!email) {
      toast.error("Please select a player");
      return;
    }
    setInviting(true);
    try {
      await teamService.invitePlayer(String(teamId), email);
      toast.success("Invitation sent");
      setSelectedInvitePlayerId("");
      const latest = await load();
      await loadInviteablePlayers(latest || team);
      setInviteOpen(false);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const filteredInviteablePlayers = useMemo(() => {
    const q = String(inviteSearch || "").trim().toLowerCase();
    if (!q) return inviteablePlayers;
    return inviteablePlayers.filter((p) => {
      const name = String(p?.name || "").toLowerCase();
      const email = String(p?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [inviteSearch, inviteablePlayers]);

  const openEditMember = (m) => {
    setEditMember(m);
    setEditForm({
      role: m.role || "player",
      position: m.position || "",
      jerseyNumber: m.jerseyNumber ?? "",
      status: m.status || "active",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!teamId || !editMember?.playerId) return;
    setSaving(true);
    try {
      await teamService.updateMemberRole(String(teamId), String(editMember.playerId), {
        role: editForm.role,
        position: editForm.position || undefined,
        jerseyNumber: editForm.jerseyNumber !== "" ? Number(editForm.jerseyNumber) : undefined,
        status: editForm.status,
      });
      toast.success("Player updated");
      setEditOpen(false);
      setEditMember(null);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = (m) => {
    if (!teamId || !m?.playerId) return;
    if (String(m.playerId) === String(captainUserId)) {
      toast.error("Cannot remove the team captain. Assign another captain first on web if needed.");
      return;
    }
    Alert.alert("Remove member", `Remove ${m.name} from this team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await teamService.removeMember(String(teamId), String(m.playerId));
            toast.success("Removed");
            await load();
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not remove");
          }
        },
      },
    ]);
  };

  const card =
    "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5";

  if (!teamId) {
    return (
      <OrganizerScreenShell title="Manage players">
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing team.</Text>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title="Manage players" scrollable={false}>
      {loading && !team ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : !team ? (
        <View className="p-5">
          <Text className="font-playfair text-neutral-600 dark:text-white/65">Team not found.</Text>
          <Pressable onPress={() => navigation.goBack()} className="mt-4 items-center rounded-2xl bg-primary py-3">
            <Text className="font-newsreader-bold text-white">Back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {!manage ? (
            <View className="px-5 pt-2">
              <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                You can view this roster. Only the creator or captain can invite, edit roles, or remove members.
              </Text>
            </View>
          ) : (
            <View className="px-5 pt-2">
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  onPress={openInvite}
                  className="flex-row items-center gap-2 rounded-2xl bg-primary px-4 py-2.5"
                >
                  <Feather name="user-plus" size={16} color="#fff" />
                  <Text className="font-newsreader-bold text-white">Invite players</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate(SCREENS.OrganizerTeamDetail, { teamId: String(teamId) })}
                  className="rounded-2xl border border-neutral-300 px-4 py-2.5 dark:border-white/20"
                >
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Team detail</Text>
                </Pressable>
              </View>
              <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">
                Invite players who play this team’s sport — they join the roster after accepting the invite in Team Invites.
              </Text>
            </View>
          )}

          <View className="mt-4 px-5">
            <View className={card}>
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Roster</Text>
              {members.length === 0 ? (
                <Text className="mt-2 font-playfair text-sm text-neutral-500 dark:text-white/55">No members yet.</Text>
              ) : (
                <View className="mt-3 gap-3">
                  {members.map((m) => (
                    <View
                      key={String(m._id || m.playerId || m.email)}
                      className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={1}>
                            {m.name}
                          </Text>
                          {m.email ? (
                            <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/65">
                              {m.email}
                            </Text>
                          ) : null}
                          <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/50">
                            {m.role} · {m.status}
                            {m.jerseyNumber !== "" && m.jerseyNumber != null ? ` · #${m.jerseyNumber}` : ""}
                            {m.position ? ` · ${m.position}` : ""}
                          </Text>
                        </View>
                        {manage ? (
                          <View className="flex-row gap-2">
                            <Pressable
                              onPress={() => openEditMember(m)}
                              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
                            >
                              <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">Edit</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => removeMember(m)}
                              className="rounded-xl border border-red-300 bg-white px-3 py-2 dark:border-red-500/40 dark:bg-white/5"
                            >
                              <Text className="font-newsreader-bold text-xs text-red-600 dark:text-red-400">Remove</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setInviteOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Invite players</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Only accounts with this sport on their profile are listed. Players join your roster after they accept.
            </Text>

            {loadingInviteablePlayers ? (
              <View className="items-center justify-center py-10">
                <ActivityIndicator color="#1F2B55" />
                <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">Loading players…</Text>
              </View>
            ) : (
              <View className="mt-3 rounded-2xl border border-neutral-200 dark:border-white/10 overflow-hidden">
                <View className="flex-row items-center gap-2 border-b border-neutral-100 px-3 py-2.5 dark:border-white/10">
                  <Feather name="search" size={16} color="rgba(107,114,128,0.9)" />
                  <TextInput
                    value={inviteSearch}
                    onChangeText={setInviteSearch}
                    placeholder="Search name or email…"
                    placeholderTextColor="rgba(156,163,175,1)"
                    autoCapitalize="none"
                    className="flex-1 font-playfair text-sm text-neutral-900 dark:text-white"
                  />
                </View>
                <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                  {filteredInviteablePlayers.length === 0 ? (
                    <View className="p-4">
                      <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                        {inviteSearch ? "No players match your search." : "No inviteable players found for this team’s sport."}
                      </Text>
                    </View>
                  ) : (
                    filteredInviteablePlayers.map((p) => {
                      const id = String(p?._id || "");
                      const selected = id && String(selectedInvitePlayerId) === id;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => setSelectedInvitePlayerId(id)}
                          className={`px-4 py-3 border-b border-neutral-100 dark:border-white/10 ${
                            selected ? "bg-neutral-50 dark:bg-white/10" : ""
                          }`}
                        >
                          <Text className="font-playfair text-sm text-neutral-900 dark:text-white/85">
                            {playerRowLabel(p)}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            <Pressable
              onPress={inviteSelectedPlayer}
              disabled={inviting || !selectedInvitePlayerId}
              className="mt-5 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {inviting ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Invite</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => !saving && setEditOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Edit member</Text>
            {editMember ? (
              <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">{editMember.name}</Text>
            ) : null}

            <Text className="mb-1 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Role</Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setEditForm((p) => ({ ...p, role: r.value }))}
                  className={`rounded-full px-3 py-2 ${
                    editForm.role === r.value ? "bg-primary" : "border border-neutral-200 dark:border-white/15"
                  }`}
                >
                  <Text className={`font-playfair text-xs ${editForm.role === r.value ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-1 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Status</Text>
            <View className="flex-row flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s.value}
                  onPress={() => setEditForm((p) => ({ ...p, status: s.value }))}
                  className={`rounded-full px-3 py-2 ${
                    editForm.status === s.value ? "bg-primary" : "border border-neutral-200 dark:border-white/15"
                  }`}
                >
                  <Text className={`font-playfair text-xs ${editForm.status === s.value ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-1 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Position</Text>
            <TextInput
              value={editForm.position}
              onChangeText={(t) => setEditForm((p) => ({ ...p, position: t }))}
              placeholder="Optional"
              placeholderTextColor="rgba(156,163,175,1)"
              className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />

            <Text className="mb-1 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Jersey number</Text>
            <TextInput
              value={String(editForm.jerseyNumber ?? "")}
              onChangeText={(t) => setEditForm((p) => ({ ...p, jerseyNumber: t.replace(/[^\d]/g, "") }))}
              placeholder="Optional"
              keyboardType="number-pad"
              placeholderTextColor="rgba(156,163,175,1)"
              className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />

            <View className="mt-6 flex-row justify-end gap-3">
              <Pressable
                disabled={saving}
                onPress={() => setEditOpen(false)}
                className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/15"
              >
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Cancel</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={saveEdit}
                className="rounded-2xl bg-primary px-4 py-3 disabled:opacity-50"
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Save</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}

