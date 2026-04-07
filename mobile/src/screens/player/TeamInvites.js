import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import coachTeamService from "../../services/coachTeamService";
import teamService from "../../services/teamService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

/** Team (academy route) invites: split organizer vs academy by inviter role. */
function sourceFromTeamInvite(inv) {
  const role = String(inv?.invitedBy?.role || "").toLowerCase();
  if (role === "organizer") return "organizer";
  return "academy";
}

function inviteMatchesSearch(inv, q) {
  if (!q) return true;
  const parts = [
    inv.teamName,
    inv.sportName,
    inv.sport?.name,
    inv.academy?.name,
    inv.coach?.firstName,
    inv.coach?.lastName,
    inv.invitedBy?.firstName,
    inv.invitedBy?.lastName,
  ];
  return parts.some((p) => p != null && String(p).toLowerCase().includes(q));
}

export default function TeamInvites() {
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const [coachRes, academyRes] = await Promise.allSettled([
        coachTeamService.getPlayerInvites(),
        teamService.getPlayerInvites(),
      ]);

      const coachInvites =
        coachRes.status === "fulfilled"
          ? (coachRes.value.data?.data || []).map((i) => ({ ...i, source: "coach" }))
          : [];
      let academyRaw = [];
      if (academyRes.status === "fulfilled") {
        const body = academyRes.value.data;
        academyRaw = Array.isArray(body) ? body : body?.data || [];
      }
      const academyInvites = academyRaw.map((i) => ({
        ...i,
        source: sourceFromTeamInvite(i),
      }));

      setInvites([...coachInvites, ...academyInvites]);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleRespond = async (teamId, action, source) => {
    try {
      setActioningId(teamId);
      if (source === "coach") {
        await coachTeamService.respondToInvite(teamId, action);
      } else {
        await teamService.respondToPlayerInvite(teamId, action);
      }
      toast.success(action === "accept" ? "Invitation accepted" : "Invitation rejected");
      setInvites((prev) => prev.filter((i) => i._id !== teamId));
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not update invitation");
    } finally {
      setActioningId(null);
    }
  };

  const countCoach = invites.filter((x) => x.source === "coach").length;
  const countAcademy = invites.filter((x) => x.source === "academy").length;
  const countOrganizer = invites.filter((x) => x.source === "organizer").length;

  const sourceOptions = [
    { value: "all", label: `All (${invites.length})` },
    { value: "coach", label: `Coach (${countCoach})` },
    { value: "academy", label: `Academy (${countAcademy})` },
    { value: "organizer", label: `Organizer (${countOrganizer})` },
  ];

  const sourceLabel =
    sourceOptions.find((o) => o.value === sourceFilter)?.label ?? `All (${invites.length})`;

  const filtered = useMemo(() => {
    let rows =
      sourceFilter === "all" ? invites : invites.filter((i) => i.source === sourceFilter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((inv) => inviteMatchesSearch(inv, q));
  }, [invites, sourceFilter, searchQuery]);

  const emptyText =
    invites.length > 0 && filtered.length === 0 && searchQuery.trim()
      ? "No invites match your search."
      : "No pending team invites.";

  return (
    <PlayerScreenShell title="Team invitations">
      <Text className="mb-1 font-playfair text-xs font-semibold text-neutral-600 dark:text-white/65">
        Invite source
      </Text>
      <Pressable
        onPress={() => setSourceMenuOpen(true)}
        className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5"
      >
        <Text className="font-playfair text-sm text-neutral-900 dark:text-white" numberOfLines={1}>
          {sourceLabel}
        </Text>
        <Feather name="chevron-down" size={20} color="rgba(107,114,128,0.9)" />
      </Pressable>

      <Modal
        visible={sourceMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceMenuOpen(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setSourceMenuOpen(false)} />
          <View className="rounded-t-3xl border border-neutral-200 bg-white px-4 pb-8 pt-2 dark:border-white/15 dark:bg-[#1a2545]">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300 dark:bg-white/25" />
            <Text className="mb-3 font-newsreader-bold text-base text-neutral-900 dark:text-white">
              Invite source
            </Text>
            {sourceOptions.map((o) => {
              const selected = sourceFilter === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    setSourceFilter(o.value);
                    setSourceMenuOpen(false);
                  }}
                  className={`flex-row items-center justify-between border-b border-neutral-100 py-3 dark:border-white/10 ${selected ? "-mx-2 rounded-xl border-0 bg-primary/10 px-2" : ""}`}
                >
                  <Text
                    className={`flex-1 font-playfair text-base ${selected ? "font-semibold text-primary" : "text-neutral-900 dark:text-white"}`}
                    numberOfLines={1}
                  >
                    {o.label}
                  </Text>
                  {selected ? <Feather name="check" size={20} color="#0A763A" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <View className="mb-3 flex-row items-center rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-white/5">
        <Feather name="search" size={18} color="rgba(107,114,128,0.9)" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search team, sport, academy, coach…"
          placeholderTextColor="rgba(107,114,128,0.85)"
          className="ml-2 flex-1 py-3 font-playfair text-neutral-900 dark:text-white"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/25">
        <Text className="font-playfair text-xs text-amber-900 dark:text-amber-100">
          You can join only one active team per sport. Accepting a new invite may be blocked if you already have an
          active team in that sport.
        </Text>
      </View>

      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="items-center rounded-2xl border border-neutral-200 bg-white py-12 dark:border-white/10 dark:bg-white/5">
          <Text className="font-playfair text-neutral-600 dark:text-white/60">{emptyText}</Text>
        </View>
      ) : (
        filtered.map((invite) => (
          <View
            key={`${invite.source}-${invite._id}`}
            className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
          >
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">
              {invite.teamName || "Team"}
            </Text>
            <Text className="mt-1 font-playfair text-sm text-secondary-600 dark:text-secondary-300">
              {invite.sportName || invite.sport?.name || "Sport"}
            </Text>
            <View className="mt-3 gap-1">
              {invite.source === "academy" ? (
                <Text className="font-playfair text-sm text-neutral-700 dark:text-white/75">
                  Academy: {invite.academy?.name || "—"}
                </Text>
              ) : null}
              {invite.source === "organizer" ? (
                <Text className="font-playfair text-sm text-neutral-700 dark:text-white/75">
                  Organizer:{" "}
                  {`${invite.invitedBy?.firstName || ""} ${invite.invitedBy?.lastName || ""}`.trim() || "—"}
                </Text>
              ) : null}
              {invite.source === "coach" ? (
                <Text className="font-playfair text-sm text-neutral-700 dark:text-white/75">
                  Coach: {invite.coach?.firstName} {invite.coach?.lastName}
                </Text>
              ) : null}
            </View>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => handleRespond(invite._id, "accept", invite.source)}
                disabled={actioningId === invite._id}
                className="flex-1 items-center rounded-xl bg-primary py-3 opacity-100 disabled:opacity-50"
              >
                <Text className="font-playfair font-semibold text-white">Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRespond(invite._id, "reject", invite.source)}
                disabled={actioningId === invite._id}
                className="flex-1 items-center rounded-xl border border-red-300 bg-red-50 py-3 dark:border-red-800 dark:bg-red-900/30"
              >
                <Text className="font-playfair font-semibold text-red-700 dark:text-red-200">Reject</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </PlayerScreenShell>
  );
}
