import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import { SCREENS } from "../constants/navigation";
import { useLiveScoresSocket } from "../hooks/useLiveScoresSocket";
import eventService from "../services/eventService";
import { selectTheme } from "../store/slices/uiSlice";
import LiveMatchDetailModal from "./LiveMatchDetailModal";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Split combined score string from API into two sides when possible. */
function parseDualScore(score) {
  const raw = String(score || "").trim();
  if (!raw) return { a: "—", b: "—" };
  const byVs = raw.split(/\s+vs\.?\s+/i);
  if (byVs.length === 2) return { a: byVs[0].trim(), b: byVs[1].trim() };
  const byDash = raw.split(/\s+-\s+/);
  if (byDash.length === 2) return { a: byDash[0].trim(), b: byDash[1].trim() };
  return { a: raw, b: "—" };
}

function formatMatchStatus(status) {
  if (!status) return "Live";
  const s = String(status).toLowerCase();
  if (s === "in_progress") return "Live";
  if (s === "scheduled") return "Scheduled";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  return String(status).replace(/_/g, " ");
}

function formatDateLabel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function mapLiveEventsToCarouselItems(events) {
  return safeArray(events).flatMap((event) =>
    safeArray(event?.liveMatches).map((match) => {
      const sideAName = match.team1Name || match.player1Name || "Side A";
      const sideBName = match.team2Name || match.player2Name || "Side B";
      const scores = parseDualScore(match.score);
      const id = String(match.matchId || match._id || `${event._id}-${match.matchNumber}-${match.round}`);
      const statsMatchId = String(match.statsMatchId || match.matchId || match._id || "").trim();
      return {
        id,
        eventId: event._id,
        statsMatchId,
        matchNumber: match.matchNumber,
        dateLabel: formatDateLabel(match.dateTime),
        sport: event.sport?.name || "Sport",
        status: formatMatchStatus(match.status),
        sideA: { name: sideAName, score: scores.a },
        sideB: { name: sideBName, score: scores.b },
        round: match.round || event.name || "",
      };
    })
  );
}

/** Must match card `mr-3` (12) — used with `snapToInterval` for index math. */
const CARD_GAP = 12;

function LiveMatchCard({ item, width, onViewDetails }) {
  const matchNoLabel = item.matchNumber != null && item.matchNumber !== "" ? item.matchNumber : "—";

  return (
    <View
      style={{ width }}
      className="mr-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
    >
      <View className="flex-row items-start gap-2">
        <Text
          className="min-w-0 flex-1 text-xs font-playfair text-neutral-600 dark:text-white/90"
          numberOfLines={2}
        >
          Match {matchNoLabel} · {item.dateLabel}
        </Text>
        <Text
          className="max-w-[32%] shrink text-xs font-playfair text-neutral-600 dark:text-white/75"
          numberOfLines={1}
        >
          {item.sport}
        </Text>
        <View className="shrink-0 rounded-xl bg-primary px-2.5 py-1">
          <Text className="text-xs font-newsreader-bold text-white">{item.status}</Text>
        </View>
      </View>

      <View className="mt-3 gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="min-w-0 flex-1 text-sm font-newsreader-bold text-neutral-900 dark:text-white"
            numberOfLines={2}
          >
            {item.sideA.name}
          </Text>
          <Text className="shrink-0 text-sm font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={1}>
            {item.sideA.score}
          </Text>
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="min-w-0 flex-1 text-sm font-newsreader-bold text-neutral-900 dark:text-white"
            numberOfLines={2}
          >
            {item.sideB.name}
          </Text>
          <Text className="shrink-0 text-sm font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={1}>
            {item.sideB.score}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-xs font-playfair text-neutral-600 dark:text-white/90" numberOfLines={2}>
          {item.round}
        </Text>
        <Pressable
          onPress={() => onViewDetails(item)}
          accessibilityRole="button"
          disabled={!item.eventId}
          className="shrink-0 rounded-2xl bg-primary px-3 py-2 opacity-100 disabled:opacity-40"
        >
          <Text className="text-xs font-playfair font-semibold text-white">View details</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LiveMatchesCarousel({ navigation }) {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const { width: windowWidth } = useWindowDimensions();
  const [liveEvents, setLiveEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCtx, setDetailCtx] = useState({ eventId: "", statsMatchId: "" });

  const fetchLiveEvents = useCallback(async () => {
    try {
      const res = await eventService.getLiveEvents();
      const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setLiveEvents(raw);
    } catch {
      setLiveEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setReady(false);
      (async () => {
        try {
          const res = await eventService.getLiveEvents();
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          if (!cancelled) setLiveEvents(raw);
        } catch {
          if (!cancelled) setLiveEvents([]);
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useLiveScoresSocket(fetchLiveEvents);

  const items = useMemo(() => mapLiveEventsToCarouselItems(liveEvents), [liveEvents]);

  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);

  useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [itemsKey]);

  const cardWidth = useMemo(() => {
    const max = 340;
    const sidePadding = 20;
    const peek = 24;
    return Math.min(max, windowWidth - sidePadding * 2 - peek);
  }, [windowWidth]);

  const slideStride = cardWidth + CARD_GAP;
  const matchCount = items.length;

  const onCarouselScrollEnd = useCallback(
    (e) => {
      if (matchCount <= 1) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / slideStride);
      setActiveIndex(Math.min(Math.max(0, idx), matchCount - 1));
    },
    [matchCount, slideStride]
  );

  const onSeeAll = () => {
    navigation.navigate(SCREENS.MyMatches);
  };

  const onViewDetails = (item) => {
    if (!item?.eventId) return;
    const mid = item.statsMatchId;
    if (mid) {
      setDetailCtx({ eventId: String(item.eventId), statsMatchId: String(mid) });
      setDetailOpen(true);
    } else {
      navigation.navigate(SCREENS.EventDetails, { eventId: String(item.eventId) });
    }
  };

  const safeIndex = matchCount > 0 ? Math.min(activeIndex, matchCount - 1) : 0;
  const counterLabel = matchCount > 0 ? `${safeIndex + 1} of ${matchCount}` : "0 of 0";

  const showLoading = !ready;
  const showEmpty = ready && matchCount === 0;

  return (
    <View className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <LiveMatchDetailModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        eventId={detailCtx.eventId}
        statsMatchId={detailCtx.statsMatchId}
        navigation={navigation}
      />
      <View className="flex-row items-center justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Feather name="radio" size={18} color={isDark ? "rgba(249,250,251,0.9)" : "rgba(17,24,39,0.85)"} />
          <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">Live matches</Text>
        </View>
        <Text
          className="mr-2 shrink-0 text-[12px] font-newsreader-semibold text-neutral-500 dark:text-white/85"
          accessibilityLiveRegion="polite"
        >
          {counterLabel}
        </Text>
        <Pressable onPress={onSeeAll} className="shrink-0 rounded-2xl bg-primary px-3 py-2" accessibilityRole="button">
          <Text className="text-sm font-playfair font-semibold text-white">See all</Text>
        </Pressable>
      </View>

      {showLoading ? (
        <View className="mt-8 items-center py-6">
          <ActivityIndicator size="small" color={isDark ? "#86efac" : "#0A763A"} />
          <Text className="mt-2 text-xs font-playfair text-neutral-500 dark:text-white/60">Loading live matches…</Text>
        </View>
      ) : showEmpty ? (
        <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">No live matches right now</Text>
          <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">
            Check back when an event is in progress.
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          className="mt-4 -mx-1"
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 2 }}
          decelerationRate="fast"
          snapToInterval={slideStride}
          snapToAlignment="start"
          disableIntervalMomentum
          onMomentumScrollEnd={onCarouselScrollEnd}
        >
          {items.map((item) => (
            <LiveMatchCard key={item.id} item={item} width={cardWidth} onViewDetails={onViewDetails} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
