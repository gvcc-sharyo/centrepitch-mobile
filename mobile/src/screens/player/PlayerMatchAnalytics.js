import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import analyticsService from "../../services/analyticsService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function summarizeModule(mod) {
  if (mod == null) return null;
  if (typeof mod === "string") return mod.slice(0, 400);
  if (typeof mod === "number" || typeof mod === "boolean") return String(mod);
  if (Array.isArray(mod)) return `${mod.length} entries`;
  const keys = Object.keys(mod);
  if (keys.length <= 4) return keys.map((k) => `${k}: ${JSON.stringify(mod[k]).slice(0, 80)}`).join("\n");
  return `${keys.length} fields`;
}

export default function PlayerMatchAnalytics() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const matchId = route.params?.matchId ? String(route.params.matchId) : "";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [full, setFull] = useState(null);

  const load = useCallback(async () => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [s, f] = await Promise.all([
        analyticsService.getMatchSummary(matchId).catch(() => null),
        analyticsService.getFullAnalytics(matchId).catch(() => null),
      ]);
      setSummary(s);
      setFull(f);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load match analytics");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const title = summary?.title || summary?.event_name || "Match analytics";

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar />
      <View className="flex-row items-center border-b border-neutral-200 px-4 py-2 dark:border-white/10">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-2 rounded-full bg-neutral-100 p-2 dark:bg-white/10"
        >
          <Feather name="arrow-left" size={22} color={isDark ? "rgba(249,250,251,0.92)" : "rgba(17,24,39,0.88)"} />
        </Pressable>
        <Text className="flex-1 font-newsreader-bold text-lg text-neutral-900 dark:text-white" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : !matchId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-playfair text-neutral-600 dark:text-white/70">Missing match id.</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        >
          {summary && typeof summary === "object" && (
            <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Summary</Text>
              {summary.score != null || summary.final_score ? (
                <Text className="mt-2 font-playfair text-sm text-neutral-700 dark:text-white/80">
                  Score: {String(summary.score ?? summary.final_score)}
                </Text>
              ) : null}
              {summary.winner != null ? (
                <Text className="mt-1 font-playfair text-sm text-neutral-700 dark:text-white/80">
                  Winner: {String(summary.winner)}
                </Text>
              ) : null}
              {Object.keys(summary).length > 0 && !summary.score && !summary.final_score && (
                <Text className="mt-2 font-mono text-xs text-neutral-600 dark:text-white/65">
                  {JSON.stringify(summary, null, 2).slice(0, 1200)}
                </Text>
              )}
            </View>
          )}

          {full && typeof full === "object" && (
            <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Full analytics</Text>
              <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                Key modules returned by the analytics engine (tier may hide some).
              </Text>
              {["score_progression", "win_probability", "momentum", "rally_analysis", "pressure_analysis"].map((key) => {
                if (full[key] == null) return null;
                const text = summarizeModule(full[key]);
                return (
                  <View key={key} className="mt-3 border-t border-neutral-100 pt-3 dark:border-white/10">
                    <Text className="font-newsreader-bold capitalize text-neutral-900 dark:text-white">
                      {key.replace(/_/g, " ")}
                    </Text>
                    {text ? (
                      <Text className="mt-1 font-playfair text-sm text-neutral-700 dark:text-white/75">{text}</Text>
                    ) : (
                      <Text className="mt-1 font-mono text-xs text-neutral-600 dark:text-white/65">
                        {JSON.stringify(full[key]).slice(0, 800)}
                      </Text>
                    )}
                  </View>
                );
              })}
              {full.message ? (
                <Text className="mt-3 font-playfair text-sm text-amber-700 dark:text-amber-300">{String(full.message)}</Text>
              ) : null}
            </View>
          )}

          {!summary && !full && (
            <View className="items-center py-10">
              <Text className="text-center font-playfair text-neutral-600 dark:text-white/70">
                No analytics payload for this match. It may not be ingested yet or your tier may limit access.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
