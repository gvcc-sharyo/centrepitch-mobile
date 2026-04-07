import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import organizerService from "../../services/organizerService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const PARTICIPANT_STATUSES = [
  { value: "registered", label: "Registered" },
  { value: "confirmed", label: "Confirmed" },
  { value: "disqualified", label: "Disqualified" },
  { value: "withdrawn", label: "Withdrawn" },
];

function playerId(row) {
  const p = row?.player;
  return String(typeof p === "object" && p?._id ? p._id : p || "");
}

function teamId(row) {
  const t = row?.team;
  return String(typeof t === "object" && t?._id ? t._id : t || "");
}

function playerName(row) {
  const p = row?.player;
  if (p && typeof p === "object") {
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "Player";
  }
  return "Player";
}

function teamName(row) {
  const t = row?.team;
  if (t && typeof t === "object") return t.name || "Team";
  return "Team";
}

export default function OrganizerEventRegistrations() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [statusTarget, setStatusTarget] = useState(null);
  const [confirmingTeamId, setConfirmingTeamId] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await organizerService.getEventParticipants(String(eventId));
      const payload = res?.data ?? res;
      const p = payload?.players ?? [];
      const t = payload?.teams ?? [];
      setPlayers(Array.isArray(p) ? p : []);
      setTeams(Array.isArray(t) ? t : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load registrations");
      setPlayers([]);
      setTeams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    load();
  }, [eventId, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const applyStatus = async (status) => {
    if (!statusTarget || !eventId) return;
    const { type, id } = statusTarget;
    try {
      await organizerService.updateParticipantStatus(String(eventId), id, status, type);
      toast.success("Status updated");
      setStatusTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Update failed");
    }
  };

  const confirmOfflinePayment = (tid) => {
    Alert.alert(
      "Confirm payment",
      "Mark this team’s registration fee as paid (offline / verified)?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm paid",
          onPress: async () => {
            setConfirmingTeamId(tid);
            try {
              await eventService.confirmOfflineTeamPayment(String(eventId), tid, {});
              toast.success("Payment marked complete");
              load();
            } catch (e) {
              toast.error(getErrorMessage(e) || "Could not confirm payment");
            } finally {
              setConfirmingTeamId(null);
            }
          },
        },
      ]
    );
  };

  const renderPlayer = ({ item }) => {
    const id = playerId(item);
    if (!id) return null;
    return (
      <View className="mb-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <Text className="font-newsreader-semibold text-neutral-900 dark:text-white">{playerName(item)}</Text>
        <Text className="mt-1 font-playfair text-xs capitalize text-neutral-500 dark:text-white/55">
          Status: {item.status || "registered"} · Payment: {item.paymentStatus || "—"}
        </Text>
        <Pressable
          onPress={() => setStatusTarget({ type: "player", id, label: playerName(item) })}
          className="mt-3 flex-row items-center gap-2 self-start rounded-xl bg-primary/15 px-3 py-2 dark:bg-primary/25"
        >
          <Feather name="edit-2" size={16} color={isDark ? "#93c5fd" : "#1F2B55"} />
          <Text className="font-playfair text-sm font-semibold text-primary dark:text-white">Change status</Text>
        </Pressable>
      </View>
    );
  };

  const renderTeam = ({ item }) => {
    const id = teamId(item);
    if (!id) return null;
    const pay = item.paymentStatus || "pending";
    const busy = confirmingTeamId === id;
    return (
      <View className="mb-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <Text className="font-newsreader-semibold text-neutral-900 dark:text-white">{teamName(item)}</Text>
        <Text className="mt-1 font-playfair text-xs capitalize text-neutral-500 dark:text-white/55">
          Status: {item.status || "registered"} · Payment: {pay}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => setStatusTarget({ type: "team", id, label: teamName(item) })}
            className="flex-row items-center gap-2 rounded-xl bg-primary/15 px-3 py-2 dark:bg-primary/25"
          >
            <Feather name="edit-2" size={16} color={isDark ? "#93c5fd" : "#1F2B55"} />
            <Text className="font-playfair text-sm font-semibold text-primary dark:text-white">Change status</Text>
          </Pressable>
          {pay === "pending" ? (
            <Pressable
              onPress={() => confirmOfflinePayment(id)}
              disabled={busy}
              className="flex-row items-center gap-2 rounded-xl border border-emerald-600 px-3 py-2 opacity-100 disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <Feather name="check-circle" size={16} color="#059669" />
              )}
              <Text className="font-playfair text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Confirm offline payment
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  if (!eventId) {
    return (
      <OrganizerScreenShell title="Registrations">
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title="Registrations" scrollable={false}>
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <Text className="mb-2 font-newsreader-bold text-base text-neutral-900 dark:text-white">Players</Text>
          {players.length === 0 ? (
            <Text className="mb-6 font-playfair text-sm text-neutral-500 dark:text-white/55">No individual registrations.</Text>
          ) : (
            players
              .filter((item) => playerId(item))
              .map((item, i) => <View key={playerId(item) || `p-${i}`}>{renderPlayer({ item })}</View>)
          )}

          <Text className="mb-2 mt-4 font-newsreader-bold text-base text-neutral-900 dark:text-white">Teams</Text>
          {teams.length === 0 ? (
            <Text className="font-playfair text-sm text-neutral-500 dark:text-white/55">No team registrations.</Text>
          ) : (
            teams
              .filter((item) => teamId(item))
              .map((item, i) => <View key={teamId(item) || `t-${i}`}>{renderTeam({ item })}</View>)
          )}
        </ScrollView>
      )}

      <Modal visible={Boolean(statusTarget)} transparent animationType="fade" onRequestClose={() => setStatusTarget(null)}>
        <Pressable className="flex-1 justify-end bg-black/45" onPress={() => setStatusTarget(null)}>
          <Pressable
            className="mx-4 mb-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1F2B55]"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="border-b border-neutral-200 px-4 py-3 font-newsreader-bold text-neutral-900 dark:border-white/10 dark:text-white">
              {statusTarget ? `Status — ${statusTarget.label}` : "Status"}
            </Text>
            {PARTICIPANT_STATUSES.map((opt, i) => (
              <Pressable
                key={opt.value}
                onPress={() => applyStatus(opt.value)}
                className={`px-4 py-3.5 ${i < PARTICIPANT_STATUSES.length - 1 ? "border-b border-neutral-100 dark:border-white/5" : ""}`}
              >
                <Text className="font-playfair text-base text-neutral-800 dark:text-white/90">{opt.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setStatusTarget(null)} className="border-t border-neutral-200 px-4 py-3 dark:border-white/10">
              <Text className="text-center font-playfair font-semibold text-neutral-600 dark:text-white/70">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
