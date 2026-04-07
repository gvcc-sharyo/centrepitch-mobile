import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import organizerService from "../../services/organizerService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatCurrency, formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "Year" },
];

export default function OrganizerDashboard() {
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const { width } = useWindowDimensions();
  const [range, setRange] = useState("all");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "All";

  const statTileClass =
    "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await organizerService.getDashboard({ range });
      const payload = res?.data ?? res;
      setData(payload);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || data?.summary || {};
  const upcoming = useMemo(() => {
    const u = data?.upcomingEvents;
    return Array.isArray(u) ? u.slice(0, 5) : [];
  }, [data]);

  const quickLinks = useMemo(
    () => [
      {
        label: "My events",
        icon: "calendar",
        tab: SCREENS.OrganizerTabEvents,
        screen: SCREENS.OrganizerMyEvents,
      },
      {
        label: "Teams",
        icon: "users",
        tab: SCREENS.OrganizerTabTeams,
        screen: SCREENS.OrganizerTeamsHome,
      },
      {
        label: "Staff",
        icon: "user-check",
        tab: SCREENS.OrganizerTabStaff,
        screen: SCREENS.OrganizerStaffHome,
      },
      {
        label: "Create event",
        icon: "plus-circle",
        tab: SCREENS.OrganizerTabEvents,
        screen: SCREENS.OrganizerCreateEvent,
      },
    ],
    []
  );

  const go = (tab, screen) => {
    navigation.navigate(tab, { screen });
  };

  const tileWidth = width >= 640 ? "w-[31%]" : "w-[48%]";

  return (
    <OrganizerScreenShell scrollable={!loading}>
      <View className="w-full max-w-[720px] self-center">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 pr-1">
            <Text className="font-newsreader-bold text-2xl text-neutral-900 dark:text-white">Organizer home</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
              Welcome{user?.firstName ? `, ${user.firstName}` : ""}! Manage events, teams, and staff.
            </Text>
          </View>
          <Pressable
            onPress={() => setRangeMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Dashboard date range"
            accessibilityHint="Opens a list of range options"
            className="mt-0.5 w-[120px] shrink-0 flex-row items-center justify-between gap-2 rounded-2xl bg-primary px-4 py-2.5 active:opacity-90"
          >
            <Text
              className="min-w-0 flex-1 font-newsreader-semibold text-base text-white"
              numberOfLines={1}
            >
              {rangeLabel}
            </Text>
            <Feather name="chevron-down" size={22} color="rgba(255,255,255,0.95)" />
          </Pressable>
        </View>

        <Modal
          visible={rangeMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRangeMenuOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setRangeMenuOpen(false)}
            accessibilityLabel="Close range menu"
          >
            <Pressable
              className="mx-4 mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1F2B55]"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="border-b border-neutral-200 px-4 py-3 font-newsreader-bold text-neutral-900 dark:border-white/10 dark:text-white">
                Date range
              </Text>
              {RANGE_OPTIONS.map((r, i) => (
                <Pressable
                  key={r.value}
                  onPress={() => {
                    setRange(r.value);
                    setRangeMenuOpen(false);
                  }}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    i < RANGE_OPTIONS.length - 1 ? "border-b border-neutral-100 dark:border-white/5" : ""
                  } ${range === r.value ? "bg-primary/10 dark:bg-primary/20" : ""}`}
                >
                  <Text
                    className={`text-base ${
                      range === r.value
                        ? "font-newsreader-semibold text-primary dark:text-white"
                        : "font-newsreader text-neutral-800 dark:text-white/90"
                    }`}
                  >
                    {r.label}
                  </Text>
                  {range === r.value ? (
                    <Feather name="check" size={20} color={isDark ? "#fff" : "#0A763A"} />
                  ) : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#1F2B55" />
          </View>
        ) : (
          <>
            <View className="mt-5 flex-row flex-wrap gap-3">
              <View className={`${statTileClass} ${tileWidth}`}>
                <Text className="text-2xl font-newsreader-bold text-primary">
                  {stats.totalEvents ?? stats.events ?? "0"}
                </Text>
                <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Events</Text>
              </View>
              <View className={`${statTileClass} ${tileWidth}`}>
                <Text className="text-2xl font-newsreader-bold text-emerald-600">
                  {stats.totalRevenue != null
                    ? formatCurrency(stats.totalRevenue, stats.currency || "INR")
                    : "0"}
                </Text>
                <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Revenue</Text>
              </View>
              <View className={`${statTileClass} ${tileWidth}`}>
                <Text className="text-2xl font-newsreader-bold text-secondary">
                  {stats.activeEvents ?? stats.liveEvents ?? "0"}
                </Text>
                <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Active</Text>
              </View>
            </View>

            <Text className="mb-3 mt-8 font-newsreader-bold text-base text-neutral-900 dark:text-white">
              Quick links
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {quickLinks.map((q) => (
                <Pressable
                  key={q.label}
                  onPress={() => go(q.tab, q.screen)}
                  className="w-[48%] items-center rounded-2xl border border-neutral-200 bg-white py-5 dark:border-white/10 dark:bg-white/5"
                >
                  <Feather name={q.icon} size={26} color={isDark ? "#60A5FA" : "#2563EB"} />
                  <Text className="mt-2 text-center text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                    {q.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-3 mt-8 font-newsreader-bold text-base text-neutral-900 dark:text-white">
              Upcoming events
            </Text>
            {upcoming.length === 0 ? (
              <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                  No upcoming events in this range. Create one from the Events tab.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {upcoming.map((ev) => (
                  <Pressable
                    key={String(ev._id || ev.id)}
                    onPress={() =>
                      navigation.navigate(SCREENS.OrganizerTabEvents, {
                        screen: SCREENS.EventDetails,
                        params: { eventId: String(ev._id || ev.id), organizerMode: true },
                      })
                    }
                    className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{ev.name}</Text>
                    {ev.startDate ? (
                      <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/60">
                        {formatDate(ev.startDate, "MMM dd, yyyy")}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </OrganizerScreenShell>
  );
}
