import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { SCREENS } from "../constants/navigation";
import eventService from "../services/eventService";
import { formatDateTime, getErrorMessage } from "../utils/helpers";

export default function LiveMatchDetailModal({
  visible,
  onClose,
  eventId,
  statsMatchId,
  navigation,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!visible || !eventId || !statsMatchId) {
      setPayload(null);
      setError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await eventService.getLiveMatchDetail(eventId, statsMatchId);
        const data = res?.data ?? res;
        if (!cancelled) setPayload(data ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e) || "Could not load match detail");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, eventId, statsMatchId]);

  const m = payload?.match;
  const ev = payload?.event;
  const stats = payload?.stats || [];
  const statRich = stats.find(
    (s) =>
      (Array.isArray(s.teamTotals?.points) && s.teamTotals.points.length > 0) ||
      (Array.isArray(s.teamTotals?.sets) && s.teamTotals.sets.length > 0)
  );
  const pointsSample = statRich?.teamTotals?.points;
  const setsSample = statRich?.teamTotals?.sets;

  const openEvent = () => {
    onClose();
    if (navigation && eventId) {
      navigation.navigate(SCREENS.EventDetails, { eventId: String(eventId) });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="rounded-t-3xl bg-white dark:bg-[#1F2B55]"
          style={{
            maxHeight: Math.min(windowHeight * 0.88, 640),
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
        <View className="flex-row items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-white/10">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-xs font-newsreader-bold uppercase text-emerald-600 dark:text-emerald-400">
              Live match
            </Text>
            <Text className="mt-1 text-lg font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
              {ev?.name || "Event"}
            </Text>
            {ev?.sport?.name ? (
              <Text className="mt-0.5 text-sm font-playfair text-neutral-600 dark:text-white/70">{ev.sport.name}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="rounded-full bg-neutral-100 p-2 dark:bg-white/10"
          >
            <Feather name="x" size={22} color="rgba(17,24,39,0.75)" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="small" color="#0A763A" />
              <Text className="mt-2 text-sm font-playfair text-neutral-600 dark:text-white/60">Loading…</Text>
            </View>
          ) : null}
          {error && !loading ? (
            <Text className="text-sm font-playfair text-red-600 dark:text-red-400">{error}</Text>
          ) : null}

          {!loading && m ? (
            <View className="gap-4 pb-4">
              <View className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="mb-2 text-xs font-playfair text-neutral-600 dark:text-white/60">
                  {m.round}
                  {m.matchNumber != null ? ` · Match ${m.matchNumber}` : ""}
                </Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="min-w-0 flex-1 text-center text-sm font-newsreader-bold text-neutral-900 dark:text-white"
                    numberOfLines={2}
                  >
                    {m.sideALabel}
                  </Text>
                  <View className="shrink-0 px-2">
                    <Text className="text-center text-2xl font-newsreader-bold text-neutral-900 dark:text-white">
                      {m.score || "—"}
                    </Text>
                    <Text className="mt-1 text-center text-[10px] font-playfair uppercase text-neutral-500 dark:text-white/50">
                      {(m.status && String(m.status).replace(/_/g, " ")) || ""}
                    </Text>
                  </View>
                  <Text
                    className="min-w-0 flex-1 text-center text-sm font-newsreader-bold text-neutral-900 dark:text-white"
                    numberOfLines={2}
                  >
                    {m.sideBLabel}
                  </Text>
                </View>
                {(m.venue || m.dateTime) && (
                  <View className="mt-3 border-t border-neutral-200 pt-3 dark:border-white/10">
                    {m.dateTime ? (
                      <View className="mb-1 flex-row items-center gap-2">
                        <Feather name="calendar" size={14} color="rgba(17,24,39,0.55)" />
                        <Text className="text-xs font-playfair text-neutral-600 dark:text-white/65">
                          {formatDateTime(m.dateTime)}
                        </Text>
                      </View>
                    ) : null}
                    {m.venue ? (
                      <View className="flex-row items-center gap-2">
                        <Feather name="map-pin" size={14} color="rgba(17,24,39,0.55)" />
                        <Text className="flex-1 text-xs font-playfair text-neutral-600 dark:text-white/65">{m.venue}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>

              {Array.isArray(setsSample) && setsSample.length > 0 ? (
                <View>
                  <Text className="mb-2 text-sm font-newsreader-bold text-neutral-900 dark:text-white">Sets</Text>
                  {setsSample.map((s, i) => (
                    <Text key={i} className="text-sm font-playfair text-neutral-700 dark:text-white/80">
                      Set {s.set_number}: {s.score_a}-{s.score_b}
                      {s.is_deuce ? " (deuce)" : ""}
                    </Text>
                  ))}
                </View>
              ) : null}

              {Array.isArray(pointsSample) && pointsSample.length > 0 ? (
                <View>
                  <Text className="mb-2 text-sm font-newsreader-bold text-neutral-900 dark:text-white">
                    Rally points (latest)
                  </Text>
                  {pointsSample.slice(-8).map((row, idx) => (
                    <Text key={idx} className="text-xs font-playfair text-neutral-600 dark:text-white/70">
                      #{row.point_id} · Set {row.set_number} · {row.score_before} → {row.ending_type || "—"}
                    </Text>
                  ))}
                </View>
              ) : null}

              {stats.length > 0 && !(pointsSample?.length > 0) && !(setsSample?.length > 0) ? (
                <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">
                  Detailed stats are recorded for this match; open the event for more.
                </Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {navigation && eventId ? (
          <View className="border-t border-neutral-200 px-5 pt-3 dark:border-white/10">
            <Pressable
              onPress={openEvent}
              className="items-center rounded-2xl bg-primary py-3"
              accessibilityRole="button"
            >
              <Text className="font-newsreader-bold text-white">Open full event</Text>
            </Pressable>
          </View>
        ) : null}
        </View>
      </View>
    </Modal>
  );
}
