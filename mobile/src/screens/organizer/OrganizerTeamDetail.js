import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
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

export default function OrganizerTeamDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const teamId = route.params?.teamId;

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [playerIdInput, setPlayerIdInput] = useState("");
  const [memberRole, setMemberRole] = useState("player");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load team");
      setTeam(null);
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

  const addMember = async () => {
    if (!teamId || !playerIdInput.trim()) {
      toast.error("Enter the player’s user id (Mongo id)");
      return;
    }
    setBusy(true);
    try {
      await teamService.addMember(String(teamId), {
        playerId: playerIdInput.trim(),
        role: memberRole || "player",
      });
      toast.success("Member added");
      setAddOpen(false);
      setPlayerIdInput("");
      setMemberRole("player");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not add member");
    } finally {
      setBusy(false);
    }
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

  const sendInvite = async () => {
    if (!teamId || !inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setBusy(true);
    try {
      await teamService.invitePlayer(String(teamId), inviteEmail.trim());
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Invite failed");
    } finally {
      setBusy(false);
    }
  };

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
              <Pressable onPress={() => setAddOpen(true)} className="rounded-2xl border border-neutral-300 px-4 py-2.5 dark:border-white/20">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Add member</Text>
              </Pressable>
              <Pressable onPress={() => setInviteOpen(true)} className="rounded-2xl border border-neutral-300 px-4 py-2.5 dark:border-white/20">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Invite by email</Text>
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

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setAddOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Add member</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Paste the player&apos;s User id (Mongo ObjectId). They must already have an account.
            </Text>
            <TextInput
              value={playerIdInput}
              onChangeText={setPlayerIdInput}
              placeholder="User id"
              autoCapitalize="none"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-3 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Role</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {["player", "captain", "vice_captain"].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setMemberRole(r)}
                  className={`rounded-full px-3 py-1 ${memberRole === r ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
                >
                  <Text className={`font-playfair text-xs ${memberRole === r ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={addMember}
              disabled={busy}
              className="mt-5 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Add</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setInviteOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Invite by email</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
              The user must already be registered on Centre Pitch with this email.
            </Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="player@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-3 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <Pressable
              onPress={sendInvite}
              disabled={busy}
              className="mt-5 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Send invite</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
