import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import Feather from "@expo/vector-icons/Feather";

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

function memberPlayerId(m) {
  const p = m?.player;
  if (p && typeof p === "object" && p._id) return String(p._id);
  if (typeof p === "string") return p;
  return "";
}

function memberLabel(m) {
  const p = m?.player;
  if (p && typeof p === "object") {
    const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
    return n || p.email || "Player";
  }
  return m?.name || m?.email || "Member";
}

function memberEmailsAndUserIds(team) {
  const emails = new Set();
  const userIds = new Set();
  const raw = Array.isArray(team?.members) ? team.members : [];
  for (const m of raw) {
    const em = String(m?.email ?? m?.player?.email ?? "").trim().toLowerCase();
    if (em) emails.add(em);
    const p = m?.player;
    const id = p && typeof p === "object" && p._id ? String(p._id) : typeof p === "string" ? p : "";
    if (id) userIds.add(id);
  }
  return { emails, userIds };
}

function playerRowLabel(p) {
  const name = String(p?.name || "").trim();
  const email = String(p?.email || "").trim();
  if (name && email) return `${name} — ${email}`;
  return email || name || "Player";
}

export default function OrganizerTeamDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const teamId = route.params?.teamId;

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteablePlayers, setInviteablePlayers] = useState([]);
  const [loadingInviteablePlayers, setLoadingInviteablePlayers] = useState(false);
  const [selectedInvitePlayerId, setSelectedInvitePlayerId] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
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

  const manage = team && canManageTeam(team, user);
  const captainUserId = refId(team?.captain);

  const card =
    "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5";

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
    [team],
  );

  const deleteTeam = () => {
    if (!teamId || !manage) return;
    Alert.alert("Delete team", "This removes the team and notifies members. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await teamService.deleteTeam(String(teamId));
            toast.success("Team deleted");
            navigation.goBack();
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not delete");
          }
        },
      },
    ]);
  };

  const removeMember = (pid, label) => {
    if (!teamId || !pid) return;
    if (pid === captainUserId) {
      toast.error("Cannot remove the team captain. Assign another captain first on web if needed.");
      return;
    }
    Alert.alert("Remove member", `Remove ${label} from this team?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await teamService.removeMember(String(teamId), pid);
            toast.success("Removed");
            load();
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not remove");
          }
        },
      },
    ]);
  };

  const openInviteModal = async () => {
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

  return (
    <OrganizerScreenShell title="Team detail" scrollable={false}>
      {!teamId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing team.</Text>
      ) : loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : !team ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Team not found.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {manage ? (
            <View className="mb-4 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => navigation.navigate(SCREENS.OrganizerEditTeam, { teamId: String(teamId) })}
                className="rounded-2xl bg-primary px-4 py-2.5"
              >
                <Text className="font-newsreader-bold text-white">Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate(SCREENS.OrganizerTeamPlayers, { teamId: String(teamId) })}
                className="rounded-2xl border border-neutral-300 px-4 py-2.5 dark:border-white/20"
              >
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Manage players</Text>
              </Pressable>
              <Pressable onPress={openInviteModal} className="rounded-2xl border border-neutral-300 px-4 py-2.5 dark:border-white/20">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Invite players</Text>
              </Pressable>
              <Pressable onPress={deleteTeam} className="rounded-2xl border border-red-400 px-4 py-2.5 dark:border-red-500/50">
                <Text className="font-newsreader-bold text-red-600 dark:text-red-400">Delete team</Text>
              </Pressable>
            </View>
          ) : (
            <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/65">
              You can view this team. Only the creator or captain can edit roster or delete.
            </Text>
          )}

          <View className={card}>
            <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">{team.name}</Text>
            {team.description ? (
              <Text className="mt-2 font-playfair text-sm leading-5 text-neutral-600 dark:text-white/70">
                {team.description}
              </Text>
            ) : null}
          </View>
          <View className={`${card} mt-3`}>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Sport</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
              {team.sport?.name || "—"}
            </Text>
          </View>
          <View className={`${card} mt-3`}>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Type / format</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
              {team.teamType || "—"} · {team.gameFormat || "—"}
            </Text>
          </View>

          <View className={`${card} mt-3`}>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Members</Text>
            {Array.isArray(team.members) && team.members.length > 0 ? (
              team.members.map((m, i) => {
                const pid = memberPlayerId(m);
                const label = memberLabel(m);
                const st = m.status || "active";
                return (
                  <View
                    key={String(m._id || pid || i)}
                    className="mt-3 flex-row items-center justify-between border-t border-neutral-100 pt-3 dark:border-white/10"
                  >
                    <View className="mr-3 flex-1">
                      <Text className="font-playfair text-sm text-neutral-800 dark:text-white/85">{label}</Text>
                      <Text className="font-playfair text-xs text-neutral-500 dark:text-white/50">
                        {st}
                        {pid ? ` · ${pid.slice(0, 8)}…` : ""}
                      </Text>
                    </View>
                    {manage && pid ? (
                      <Pressable onPress={() => removeMember(pid, label)} className="rounded-lg border border-red-300 px-2 py-1 dark:border-red-500/40">
                        <Text className="font-playfair text-xs text-red-600 dark:text-red-400">Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text className="mt-2 font-playfair text-sm text-neutral-500 dark:text-white/55">No members yet.</Text>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setInviteOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Invite players</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Only accounts with this sport on their profile are listed. Players join your roster after they accept the invite.
            </Text>

            {loadingInviteablePlayers ? (
              <View className="py-8 items-center justify-center">
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
                <FlatList
                  data={filteredInviteablePlayers}
                  keyExtractor={(item, idx) => String(item?._id || idx)}
                  style={{ maxHeight: 320 }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View className="p-4">
                      <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                        {inviteSearch ? "No players match your search." : "No inviteable players found for this team’s sport."}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const id = String(item?._id || "");
                    const selected = id && String(selectedInvitePlayerId) === id;
                    return (
                      <Pressable
                        onPress={() => setSelectedInvitePlayerId(id)}
                        className={`px-4 py-3 border-b border-neutral-100 dark:border-white/10 ${selected ? "bg-neutral-50 dark:bg-white/10" : ""}`}
                      >
                        <Text className="font-playfair text-sm text-neutral-900 dark:text-white/85">{playerRowLabel(item)}</Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            )}

            <Pressable
              onPress={inviteSelectedPlayer}
              disabled={inviting || !selectedInvitePlayerId}
              className="mt-5 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {inviting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-newsreader-bold text-white">Invite</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
