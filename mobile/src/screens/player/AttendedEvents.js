import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import playerService from "../../services/playerService";
import { formatDateTime, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function rowMatchesSearch(item, q) {
  if (!q) return true;
  const parts = [
    item.eventName,
    item.event?.name,
    item.name,
    item.matchLabel,
    item.sport?.name,
    item.opponentName,
    item.resultLabel,
    item.status,
  ];
  return parts.some((p) => p != null && String(p).toLowerCase().includes(q));
}

export default function AttendedEvents() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPage = useCallback(async (p, isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const params = { page: p, limit: 12 };
      const res = await playerService.getAttendedMatches(params);
      const rows = res?.data || [];
      setMatches(Array.isArray(rows) ? rows : []);
      setPagination(res?.pagination || { current: 1, pages: 1, total: 0 });
      setPage(p);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load history");
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((item) => rowMatchesSearch(item, q));
  }, [matches, searchQuery]);

  const listEmptyText =
    matches.length > 0 && filteredMatches.length === 0 && searchQuery.trim()
      ? "No matches match your search."
      : "No attended matches in your history yet.";

  return (
    <PlayerScreenShell title="Attended matches" scrollable={false}>
      <View className="mb-3 flex-row items-center rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-white/5">
        <Feather name="search" size={18} color="rgba(107,114,128,0.9)" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by event, sport, opponent…"
          placeholderTextColor="rgba(107,114,128,0.85)"
          className="ml-2 flex-1 py-3 font-playfair text-neutral-900 dark:text-white"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && matches.length === 0 ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item, i) =>
            String(item.matchId || item._id || item.eventId || item.id || i)
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(1, true)} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">{listEmptyText}</Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white">
                {item.eventName || item.event?.name || item.matchLabel || "Match"}
              </Text>
              <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/65">
                {item.sport?.name ? `${item.sport.name} · ` : ""}
                {formatDateTime(item.dateTime || item.matchDate || item.endDate || item.createdAt)}
              </Text>
              {item.opponentName ? (
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                  vs {item.opponentName}
                </Text>
              ) : null}
              {item.score != null || item.resultLabel ? (
                <Text className="mt-2 font-playfair text-sm text-neutral-800 dark:text-white/85">
                  Score: {item.score ?? item.resultLabel}
                </Text>
              ) : null}
              <Text className="mt-1 font-playfair text-xs text-primary">
                {item.won === true ? "Win" : item.won === false ? "Loss" : "Completed"}
              </Text>
            </View>
          )}
          ListFooterComponent={
            page < (pagination.pages || 1) ? (
              <Pressable onPress={() => fetchPage(page + 1, false)} className="items-center py-3">
                <Text className="font-playfair text-sm text-primary">Load more</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </PlayerScreenShell>
  );
}
