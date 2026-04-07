import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import { SCREENS } from "../../constants/navigation";
import playerService from "../../services/playerService";
import eventService from "../../services/eventService";
import { formatDate, getErrorMessage, getEventStatus } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function MyEvents() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const searchDebounce = useRef(null);

  const fetchPage = useCallback(
    async (p, opts = {}) => {
      const { isRefresh } = opts;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const params = { page: p, limit: 10 };
        if (q.trim()) params.search = q.trim();
        const res = await playerService.getMyEvents(params);
        const rows = res?.data || [];
        setEvents(Array.isArray(rows) ? rows : []);
        setPagination(res?.pagination || { current: 1, pages: 1, total: 0 });
        setPage(p);
      } catch (e) {
        toast.error(getErrorMessage(e) || "Failed to load events");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [q]
  );

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setQ(search), 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [search]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const onOpen = (eventId) => {
    if (!eventId) return;
    navigation.navigate(SCREENS.EventDetails, { eventId: String(eventId) });
  };

  const onWithdraw = async (eventId) => {
    try {
      await eventService.withdrawFromEvent(eventId);
      toast.success("Withdrawn from event");
      fetchPage(page, { isRefresh: true });
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not withdraw");
    }
  };

  return (
    <PlayerScreenShell title="My events" scrollable={false}>
      <View className="mb-3 flex-row items-center rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-white/5">
        <Feather name="search" size={18} color="rgba(107,114,128,0.9)" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setQ(search)}
          placeholder="Search by name, sport, location…"
          placeholderTextColor="rgba(107,114,128,0.85)"
          className="ml-2 flex-1 py-3 font-playfair text-neutral-900 dark:text-white"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && events.length === 0 ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(1, { isRefresh: true })} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <Text className="py-8 text-center font-playfair text-neutral-600 dark:text-white/60">No registered events.</Text>
          }
          renderItem={({ item }) => {
            const lifecycle = getEventStatus(item);
            const reg = item.myRegistration;
            return (
              <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Pressable onPress={() => onOpen(item._id)}>
                  <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                    {formatDate(item.startDate)} · {item.sport?.name || "Sport"}
                  </Text>
                  <Text className="mt-2 font-playfair text-xs capitalize text-primary">
                    {lifecycle} {reg?.status ? `· ${reg.status}` : ""}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onWithdraw(item._id)}
                  className="mt-3 self-start rounded-lg border border-red-200 px-3 py-1.5 dark:border-red-800"
                >
                  <Text className="font-playfair text-xs text-red-700 dark:text-red-200">Withdraw</Text>
                </Pressable>
              </View>
            );
          }}
          ListFooterComponent={
            page < (pagination.pages || 1) ? (
              <Pressable onPress={() => fetchPage(page + 1)} className="items-center py-3">
                <Text className="font-playfair text-sm text-primary">Load more</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </PlayerScreenShell>
  );
}
