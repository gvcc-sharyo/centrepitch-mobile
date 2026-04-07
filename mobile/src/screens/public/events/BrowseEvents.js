import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";

import AppHeaderBar from "../../../components/AppHeaderBar";
import { SCREENS } from "../../../constants/navigation";
import eventService from "../../../services/eventService";
import sportService from "../../../services/sportService";
import { formatCurrency, formatDate, getErrorMessage, getEventStatus } from "../../../utils/helpers";
import { toast } from "../../../utils/toast";

const HERO = require("../../../../assets/public/bento_events_bg.png");

const TIME_OPTIONS = [
  { value: "", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "past", label: "Past" },
];

function statusBadgeClass(status) {
  switch (status) {
    case "live":
      return "bg-emerald-500/20";
    case "completed":
      return "bg-neutral-200 dark:bg-white/10";
    case "upcoming":
      return "bg-blue-500/15";
    default:
      return "bg-neutral-200 dark:bg-white/10";
  }
}

export default function BrowseEvents() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const skipSearchDebounce = useRef(true);
  const [sportFilter, setSportFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("");
  const [sportOptions, setSportOptions] = useState([]);

  useEffect(() => {
    sportService
      .getSportsList()
      .then((res) => {
        const list = res?.data || res?.sports || res || [];
        setSportOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => setSportOptions([]));
  }, []);

  const runFetch = useCallback(
    async (page) => {
      try {
        setLoading(true);
        const params = {
          page,
          limit: 12,
          sortBy: "startDate",
          sortOrder: timeFilter === "past" ? "desc" : "asc",
        };
        if (search.trim()) params.search = search.trim();
        if (sportFilter && sportFilter !== "all") params.sport = sportFilter;
        if (timeFilter) params.timeFilter = timeFilter;

        const response = await eventService.getEvents(params);
        setEvents(response.data || []);
        setPagination((prev) => ({
          ...prev,
          current: response.pagination?.current ?? page,
          pages: response.pagination?.pages ?? 1,
          total: response.pagination?.total ?? 0,
        }));
      } catch (error) {
        toast.error(getErrorMessage(error));
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [search, sportFilter, timeFilter]
  );

  useEffect(() => {
    if (skipSearchDebounce.current) {
      skipSearchDebounce.current = false;
      return;
    }
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, current: 1 }));
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    runFetch(pagination.current);
  }, [search, sportFilter, timeFilter, pagination.current, runFetch]);

  const timeChips = useMemo(() => TIME_OPTIONS, []);

  const renderItem = ({ item: event }) => {
    const status = getEventStatus(event);
    return (
      <Pressable
        onPress={() => navigation.navigate(SCREENS.EventDetails, { eventId: event._id })}
        className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
      >
        <View className="h-40 bg-neutral-200 dark:bg-white/10">
          {event.bannerImages?.[0] ? (
            <ImageBackground source={{ uri: event.bannerImages[0] }} className="h-full w-full" resizeMode="cover">
              <View className="flex-1 justify-between p-3">
                <View className="flex-row justify-between">
                  <View className={`rounded-full px-2.5 py-0.5 ${statusBadgeClass(status)}`}>
                    <Text className="text-xs font-newsreader-bold capitalize text-neutral-900 dark:text-white">
                      {status}
                    </Text>
                  </View>
                  <View className="rounded-full bg-white/90 px-2.5 py-0.5 dark:bg-white/20">
                    <Text className="text-xs font-playfair font-semibold text-neutral-900 dark:text-white">
                      {event.sport?.name || "Event"}
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          ) : (
            <ImageBackground source={HERO} className="h-full w-full" resizeMode="cover">
              <View className="flex-1 justify-between bg-black/35 p-3">
                <View className="flex-row justify-between">
                  <View className={`rounded-full px-2.5 py-0.5 ${statusBadgeClass(status)}`}>
                    <Text className="text-xs font-newsreader-bold capitalize text-white">{status}</Text>
                  </View>
                  <View className="rounded-full bg-white/90 px-2.5 py-0.5">
                    <Text className="text-xs font-playfair font-semibold text-neutral-900">
                      {event.sport?.name || "Event"}
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          )}
        </View>
        <View className="p-4">
          <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
            {event.name}
          </Text>
          {event.description ? (
            <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/65" numberOfLines={2}>
              {event.description}
            </Text>
          ) : null}
          <View className="mt-3 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Feather name="calendar" size={14} color="rgba(31,43,85,0.75)" />
              <Text className="text-sm font-playfair text-neutral-700 dark:text-white/75">
                {formatDate(event.startDate, "MMM dd, yyyy")}
              </Text>
            </View>
            {event.location?.city ? (
              <View className="flex-row items-center gap-2">
                <Feather name="map-pin" size={14} color="rgba(31,43,85,0.75)" />
                <Text className="text-sm font-playfair text-neutral-700 dark:text-white/75">
                  {event.location.city}
                  {event.location.country ? `, ${event.location.country}` : ""}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Feather name="dollar-sign" size={14} color="rgba(31,43,85,0.75)" />
              <Text className="text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                {event.registrationFee > 0
                  ? formatCurrency(event.registrationFee, event.currency || "INR")
                  : "Free entry"}
              </Text>
            </View>
          </View>
          <Text className="mt-3 text-sm font-playfair font-semibold text-primary">View details →</Text>
        </View>
      </Pressable>
    );
  };

  const listHeader = (
    <View>
      <View className="mb-4 overflow-hidden rounded-2xl">
        <ImageBackground source={HERO} className="min-h-[140px] justify-end px-4 pb-4 pt-6" resizeMode="cover">
          <View className="rounded-xl bg-black/45 px-3 py-2">
            <Text className="text-center text-xl font-newsreader-bold text-white">Discover Sports Events</Text>
            <Text className="mt-1 text-center text-sm font-playfair text-white/90">
              Find upcoming, live, and past events
            </Text>
          </View>
        </ImageBackground>
      </View>

      <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
        <View className="flex-row items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 dark:border-white/10 dark:bg-white/5">
          <Feather name="search" size={18} color="rgba(17,24,39,0.45)" />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by name or description..."
            placeholderTextColor="rgba(17,24,39,0.35)"
            className="flex-1 py-2.5 text-base text-neutral-900 dark:text-white"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
          {timeChips.map((opt) => {
            const active = timeFilter === opt.value;
            return (
              <Pressable
                key={opt.value || "all-time"}
                onPress={() => {
                  setTimeFilter(opt.value);
                  setPagination((p) => ({ ...p, current: 1 }));
                }}
                className={`rounded-full px-3 py-2 ${active ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
              >
                <Text
                  className={`text-xs font-newsreader-bold ${active ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text className="mb-2 mt-3 text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">Sport</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              setSportFilter("all");
              setPagination((p) => ({ ...p, current: 1 }));
            }}
            className={`rounded-full px-3 py-2 ${sportFilter === "all" ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
          >
            <Text
              className={`text-xs font-newsreader-bold ${sportFilter === "all" ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
            >
              All sports
            </Text>
          </Pressable>
          {sportOptions.map((s) => (
            <Pressable
              key={s._id}
              onPress={() => {
                setSportFilter(s._id);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              className={`rounded-full px-3 py-2 ${sportFilter === s._id ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
            >
              <Text
                className={`text-xs font-newsreader-bold ${sportFilter === s._id ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text className="mb-3 text-lg font-newsreader-bold text-neutral-900 dark:text-white">
        {pagination.total} {pagination.total === 1 ? "event" : "events"}
      </Text>
    </View>
  );

  const listFooter = !loading && pagination.pages > 1 && (
    <View className="mt-2 flex-row items-center justify-center gap-4 pb-4">
      <Pressable
        onPress={() => setPagination((p) => ({ ...p, current: Math.max(1, p.current - 1) }))}
        disabled={pagination.current <= 1}
        className={`rounded-xl px-4 py-2 ${pagination.current <= 1 ? "opacity-40" : "bg-white dark:bg-white/10"}`}
      >
        <Text className="font-playfair font-semibold text-neutral-900 dark:text-white">Previous</Text>
      </Pressable>
      <Text className="text-sm font-playfair text-neutral-600 dark:text-white/70">
        Page {pagination.current} / {pagination.pages}
      </Text>
      <Pressable
        onPress={() => setPagination((p) => ({ ...p, current: Math.min(p.pages, p.current + 1) }))}
        disabled={pagination.current >= pagination.pages}
        className={`rounded-xl px-4 py-2 ${pagination.current >= pagination.pages ? "opacity-40" : "bg-white dark:bg-white/10"}`}
      >
        <Text className="font-playfair font-semibold text-neutral-900 dark:text-white">Next</Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Events" />
      {loading && events.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center rounded-2xl border border-neutral-200 bg-white py-12 dark:border-white/10 dark:bg-white/5">
                <Feather name="calendar" size={48} color="rgba(255,255,255,0.25)" />
                <Text className="mt-4 font-newsreader-bold text-neutral-900 dark:text-white">No events found</Text>
                <Text className="mt-1 px-6 text-center font-playfair text-neutral-600 dark:text-white/65">
                  Try adjusting search or filters
                </Text>
                <Pressable
                  onPress={() => {
                    setSearchInput("");
                    setSearch("");
                    setSportFilter("all");
                    setTimeFilter("");
                    setPagination((p) => ({ ...p, current: 1 }));
                  }}
                  className="mt-4"
                >
                  <Text className="font-playfair font-semibold text-primary">Clear filters</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
