import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
    item.status,
    item.round,
    item.venue,
    item.participantType,
  ];
  return parts.some((p) => p != null && String(p).toLowerCase().includes(q));
}

export default function MyMatches() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const fetchPage = useCallback(
    async (p, isRefresh) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const params = { page: p, limit: 15 };
        if (statusFilter) params.status = statusFilter;
        const res = await playerService.getMyMatches(params);
        const rows = res?.data || [];
        setMatches(Array.isArray(rows) ? rows : []);
        setPagination(res?.pagination || { current: 1, pages: 1, total: 0 });
        setPage(p);
      } catch (e) {
        toast.error(getErrorMessage(e) || "Failed to load matches");
        setMatches([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((item) => rowMatchesSearch(item, q));
  }, [matches, searchQuery]);

  const statusOptions = [
    { value: "", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "live", label: "Live" },
    { value: "completed", label: "Completed" },
  ];

  const statusLabel =
    statusOptions.find((o) => o.value === statusFilter)?.label ?? "All";

  const listEmptyText =
    matches.length > 0 && filteredMatches.length === 0 && searchQuery.trim()
      ? "No matches match your search."
      : "No matches yet. When the backend exposes your schedule, it will show here.";

  return (
    <PlayerScreenShell title="My matches" scrollable={false}>


      <Modal
        visible={statusMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuOpen(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setStatusMenuOpen(false)} />
          <View className="rounded-t-3xl border border-neutral-200 bg-white px-4 pb-8 pt-2 dark:border-white/15 dark:bg-[#1a2545]">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300 dark:bg-white/25" />
            <Text className="mb-3 font-newsreader-bold text-base text-neutral-900 dark:text-white">Match status</Text>
            {statusOptions.map((o) => {
              const selected = statusFilter === o.value;
              return (
                <Pressable
                  key={o.value || "all"}
                  onPress={() => {
                    setStatusFilter(o.value);
                    setStatusMenuOpen(false);
                  }}
                  className={`flex-row items-center justify-between border-b border-neutral-100 py-3 dark:border-white/10 ${selected ? "-mx-2 rounded-xl border-0 bg-primary/10 px-2" : ""}`}
                >
                  <Text
                    className={`font-playfair text-base ${selected ? "font-semibold text-primary" : "text-neutral-900 dark:text-white"}`}
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

      
      <Text className="mb-1 font-playfair text-xs font-semibold text-neutral-600 dark:text-white/65">Sports</Text>

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

      <Text className="mb-1 font-playfair text-xs font-semibold text-neutral-600 dark:text-white/65">Status</Text>
      <Pressable
        onPress={() => setStatusMenuOpen(true)}
        className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5"
      >
        <Text className="font-playfair text-sm text-neutral-900 dark:text-white">{statusLabel}</Text>
        <Feather name="chevron-down" size={20} color="rgba(107,114,128,0.9)" />
      </Pressable>

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
                {item.eventName || item.event?.name || item.name || "Match"}
              </Text>
              <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/65">
                {item.sport?.name ? `${item.sport.name} · ` : ""}
                {formatDateTime(item.dateTime || item.startTime || item.matchDate || item.createdAt)}
              </Text>
              {item.opponentName ? (
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                  vs {item.opponentName}
                </Text>
              ) : null}
              <Text className="mt-2 font-playfair text-xs capitalize text-primary">
                {item.status || "scheduled"}
                {item.won === true ? " · Win" : item.won === false && item.status === "completed" ? " · Loss" : ""}
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
