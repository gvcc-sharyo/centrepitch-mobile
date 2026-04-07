import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function MatchSchedule() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.85)" : "rgba(17,24,39,0.8)";

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await organizerService.getEventSchedule(String(eventId));
      const data = res?.data ?? res;
      setSchedule(data);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load schedule");
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const rounds = schedule?.rounds || schedule?.schedule?.rounds || [];

  return (
    <OrganizerScreenShell title="Match schedule">
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : rounds.length === 0 ? (
        <View className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <Feather name="calendar" size={36} color={iconColor} style={{ alignSelf: "center" }} />
          <Text className="mt-3 text-center font-playfair text-neutral-600 dark:text-white/65">
            No rounds yet. Build the schedule on the web dashboard, or add matches via the organizer API.
          </Text>
          <Pressable onPress={load} className="mt-4 items-center rounded-2xl bg-primary py-3">
            <Text className="font-newsreader-bold text-white">Refresh</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-4">
          {rounds.map((round) => (
            <View
              key={String(round.name || round.roundName || Math.random())}
              className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">
                {round.name || round.roundName || "Round"}
              </Text>
              {Array.isArray(round.matches) ? (
                <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">
                  {round.matches.length} match{round.matches.length === 1 ? "" : "es"}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </OrganizerScreenShell>
  );
}
