import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import eventService from "../../services/eventService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatDate, getErrorMessage, getEventStatus } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function statusBadgeClass(status) {
  switch (status) {
    case "live":
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    case "draft":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "completed":
      return "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/80";
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }
}

export default function MyEvents() {
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchPage = useCallback(
    async (p, isRefresh) => {
      const uid = user?._id;
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        const res = await eventService.getEventsByOrganizer(String(uid), {
          page: p,
          limit: 20,
        });
        const rows = res?.data ?? res?.events ?? [];
        const list = Array.isArray(rows) ? rows : [];
        setEvents((prev) => (p === 1 ? list : [...prev, ...list]));
        setTotalPages(res?.pagination?.pages ?? res?.pagination?.totalPages ?? 1);
        setPage(p);
      } catch (e) {
        toast.error(getErrorMessage(e) || "Failed to load events");
        setEvents([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?._id]
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => String(ev.name || "").toLowerCase().includes(q));
  }, [events, search]);

  const numColumns = width >= 900 ? 2 : 1;

  const renderItem = ({ item }) => {
    const status = getEventStatus(item);
    return (
      <Pressable
        onPress={() =>
          navigation.navigate(SCREENS.EventDetails, {
            eventId: String(item._id),
            organizerMode: true,
          })
        }
        className={`mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${
          numColumns === 2 ? "mx-1.5 flex-1" : ""
        }`}
      >
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 font-newsreader-bold text-base text-neutral-900 dark:text-white" numberOfLines={2}>
            {item.name}
          </Text>
          <View className={`rounded-full px-2 py-0.5 ${statusBadgeClass(status)}`}>
            <Text className="text-[10px] font-newsreader-bold capitalize text-neutral-900 dark:text-white">
              {status}
            </Text>
          </View>
        </View>
        {item.startDate ? (
          <Text className="mt-2 font-playfair text-xs text-neutral-600 dark:text-white/60">
            {formatDate(item.startDate, "MMM dd, yyyy")}
          </Text>
        ) : null}
        {item.location?.city ? (
          <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/50">{item.location.city}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <OrganizerScreenShell title="My events" scrollable={false} showBack={false}>
      <View className="w-full max-w-[720px] flex-1 self-center">
        <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/10 dark:bg-white/5">
          <Feather name="search" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search events"
            placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)"}
            className="min-h-11 flex-1 py-2 font-playfair text-base text-neutral-900 dark:text-white"
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate(SCREENS.OrganizerCreateEvent)}
          className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5"
        >
          <Feather name="plus" size={20} color="#fff" />
          <Text className="font-newsreader-bold text-white">Create event</Text>
        </Pressable>

        {loading && events.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#1F2B55" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            key={numColumns}
            keyExtractor={(item) => String(item._id)}
            numColumns={numColumns}
            columnWrapperStyle={numColumns === 2 ? { paddingHorizontal: 4 } : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(1, true)} />}
            ListEmptyComponent={
              <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
                No events yet. Create your first event.
              </Text>
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {totalPages > 1 && page < totalPages ? (
          <Pressable
            onPress={() => fetchPage(page + 1, false)}
            className="mt-2 items-center rounded-2xl border border-neutral-200 py-3 dark:border-white/15"
          >
            <Text className="font-playfair font-semibold text-neutral-800 dark:text-white">Load more</Text>
          </Pressable>
        ) : null}
      </View>
    </OrganizerScreenShell>
  );
}
