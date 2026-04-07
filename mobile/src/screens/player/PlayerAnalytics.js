import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import analyticsService from "../../services/analyticsService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatDateTime, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function pickMatchId(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.match_id ?? row.centrepitch_match_id ?? row.matchId ?? "").trim();
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.success === false) return null;
  return raw.profile ?? raw.data ?? raw;
}

export default function PlayerAnalytics() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const playerId = user?._id ? String(user._id) : "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchTotal, setMatchTotal] = useState(0);
  const [trends, setTrends] = useState(null);
  const [last10, setLast10] = useState(null);
  const [h2h, setH2H] = useState([]);
  const [pressure, setPressure] = useState(null);

  const load = useCallback(
    async (isRefresh) => {
      if (!playerId) {
        setLoading(false);
        return;
      }
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const [p, m, t, l10, h, pr] = await Promise.all([
          analyticsService.getPlayerProfile(playerId).catch(() => null),
          analyticsService.getPlayerMatches(playerId, { limit: 20, offset: 0 }).catch(() => null),
          analyticsService.getPlayerTrends(playerId).catch(() => null),
          analyticsService.getPlayerLast10Trends(playerId, { limit: 10 }).catch(() => null),
          analyticsService.getPlayerH2H(playerId).catch(() => null),
          analyticsService.getPlayerPressureRating(playerId).catch(() => null),
        ]);

        setProfile(normalizeProfile(p));
        const mrows = m?.matches;
        setMatches(Array.isArray(mrows) ? mrows : []);
        setMatchTotal(Number(m?.total ?? 0));
        setTrends(t);
        setLast10(l10);
        setH2H(Array.isArray(h) ? h : Array.isArray(h?.h2h) ? h.h2h : []);
        setPressure(pr);
      } catch (e) {
        toast.error(getErrorMessage(e) || "Failed to load analytics");
        setProfile(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [playerId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const stats = profile?.stats || {};
  const wins = stats.total_wins ?? stats.wins ?? 0;
  const losses = stats.total_losses ?? stats.losses ?? 0;
  const totalPlayed = wins + losses;
  const winPct =
    totalPlayed > 0 ? `${((wins / totalPlayed) * 100).toFixed(1)}%` : "—";

  const rawPressure = pressure?.pressure_rating ?? stats?.pressure_rating;
  const pressureRating =
    rawPressure != null && rawPressure !== "" && !Number.isNaN(Number(rawPressure))
      ? Number(rawPressure)
      : null;
  const pressureText =
    pressure?.interpretation ||
    (pressureRating == null
      ? null
      : pressureRating > 0.05
        ? "Clutch — performs better under pressure"
        : pressureRating < -0.05
          ? "Pressure-sensitive — performance drops in close games"
          : "Consistent — pressure has minimal effect");

  const last10Rows = useMemo(() => {
    const v = last10?.matches ?? last10?.data ?? last10;
    return Array.isArray(v) ? v : [];
  }, [last10]);

  const last10Wins = useMemo(() => last10Rows.filter((x) => x?.won).length, [last10Rows]);

  const h2hPreview = useMemo(() => h2h.slice(0, 8), [h2h]);

  const trendLine = useMemo(() => {
    if (!trends || typeof trends !== "object") return null;
    const parts = [];
    if (trends.recent_form != null) parts.push(`Recent form: ${String(trends.recent_form)}`);
    if (trends.momentum != null) parts.push(`Momentum: ${String(trends.momentum)}`);
    return parts.length ? parts.join(" · ") : JSON.stringify(trends).slice(0, 180);
  }, [trends]);

  if (!playerId) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-playfair text-neutral-600 dark:text-white/70">
            Sign in as a player to view performance analytics.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar />
      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-newsreader-bold text-2xl text-neutral-900 dark:text-white">Analytics</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/65">
              Performance insights from completed matches (CentrePitch + analytics engine).
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Feather name="bar-chart-2" size={22} color={isDark ? "#93C5FD" : "#1F2B55"} />
          </View>
        </View>

        {loading && !profile ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#0A763A" />
          </View>
        ) : !profile ? (
          <View className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <Feather name="activity" size={28} color={isDark ? "rgba(249,250,251,0.5)" : "rgba(17,24,39,0.35)"} />
            <Text className="mt-3 font-newsreader-bold text-neutral-900 dark:text-white">No analytics profile yet</Text>
            <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">
              Complete matches and ensure analytics ingest is enabled. Data appears after the engine processes your
              matches.
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-2 flex-row items-center gap-3">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <Text className="font-newsreader-bold text-xl text-primary">
                  {(profile.name || user?.firstName || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">
                  {profile.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Player"}
                </Text>
                <Text className="font-playfair text-xs capitalize text-neutral-500 dark:text-white/55">
                  {profile.sport_id || "badminton"}
                </Text>
              </View>
            </View>

            <View className="mt-2 flex-row flex-wrap gap-2">
              <StatPill label="Wins" value={String(wins)} tone="emerald" />
              <StatPill label="Losses" value={String(losses)} tone="rose" />
              <StatPill label="Win rate" value={winPct} tone="primary" />
              <StatPill label="Tracked" value={matchTotal ? String(matchTotal) : String(matches.length)} tone="slate" />
            </View>

            {pressureRating != null && (
              <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Pressure rating</Text>
                <Text className="mt-1 font-newsreader-bold text-primary">{pressureRating.toFixed(3)}</Text>
                {pressureText ? (
                  <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/70">{pressureText}</Text>
                ) : null}
              </View>
            )}

            {trendLine ? (
              <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Trends</Text>
                <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/70">{trendLine}</Text>
              </View>
            ) : null}

            {last10Rows.length > 0 && (
              <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Last 10 matches</Text>
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                  {last10Wins}W / {last10Rows.length - last10Wins}L
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {last10Rows.map((m, i) => (
                    <View
                      key={`${pickMatchId(m) || i}`}
                      className={`h-9 w-9 items-center justify-center rounded-full border ${
                        m.won
                          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/30"
                          : "border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-900/30"
                      }`}
                    >
                      <Text
                        className={`font-newsreader-bold text-xs ${
                          m.won ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"
                        }`}
                      >
                        {m.won ? "W" : "L"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {h2hPreview.length > 0 && (
              <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Head-to-head</Text>
                {h2hPreview.map((row, idx) => (
                  <View
                    key={`${row.opponent_id || row.opponent_name || idx}`}
                    className="mt-2 flex-row items-center justify-between border-t border-neutral-100 pt-2 dark:border-white/10"
                  >
                    <Text className="flex-1 font-playfair text-sm text-neutral-800 dark:text-white/85">
                      {row.opponent_name || row.opponent_id || "Opponent"}
                    </Text>
                    <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">
                      {row.wins ?? 0}W / {row.matches ?? 0} played
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text className="mb-2 mt-6 font-newsreader-bold text-neutral-900 dark:text-white">Match history</Text>
            <Text className="mb-3 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Tap a match for detailed analytics when available.
            </Text>

            {matches.length === 0 ? (
              <Text className="py-6 text-center font-playfair text-neutral-600 dark:text-white/60">
                No ingested matches listed yet.
              </Text>
            ) : (
              matches.map((item, index) => {
                const mid = pickMatchId(item);
                const won = item?.won;
                const when = item?.date ? formatDateTime(item.date) : "—";
                return (
                  <Pressable
                    key={pickMatchId(item) || String(index)}
                    onPress={() => {
                      if (!mid) {
                        toast.error("No match id for analytics");
                        return;
                      }
                      navigation.navigate(SCREENS.PlayerMatchAnalytics, { matchId: mid });
                    }}
                    className="mb-2 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="font-playfair text-sm text-neutral-900 dark:text-white" numberOfLines={1}>
                        {item.event_name || item.eventName || "Event"}
                      </Text>
                      <Text className="mt-0.5 font-playfair text-xs text-neutral-500 dark:text-white/55">{when}</Text>
                      {mid ? (
                        <Text className="mt-1 font-mono text-[10px] text-neutral-400 dark:text-white/40" numberOfLines={1}>
                          {mid}
                        </Text>
                      ) : null}
                    </View>
                    {won === true || won === false ? (
                      <View
                        className={`rounded-full px-2 py-1 ${
                          won ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-rose-100 dark:bg-rose-900/40"
                        }`}
                      >
                        <Text
                          className={`font-newsreader-bold text-xs ${
                            won ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"
                          }`}
                        >
                          {won ? "Win" : "Loss"}
                        </Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={18} color={isDark ? "rgba(249,250,251,0.45)" : "#9CA3AF"} />
                    )}
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatPill({ label, value, tone }) {
  const border =
    tone === "emerald"
      ? "border-emerald-200 dark:border-emerald-700"
      : tone === "rose"
        ? "border-rose-200 dark:border-rose-700"
        : tone === "primary"
          ? "border-primary/40"
          : "border-neutral-200 dark:border-white/15";
  return (
    <View className={`min-w-[23%] flex-1 rounded-2xl border ${border} bg-white px-3 py-3 dark:bg-white/5`}>
      <Text className="font-playfair text-[10px] uppercase tracking-wide text-neutral-500 dark:text-white/55">{label}</Text>
      <Text className="mt-1 font-newsreader-bold text-lg text-neutral-900 dark:text-white">{value}</Text>
    </View>
  );
}
