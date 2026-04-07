import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import AppHeaderBar from "../../components/AppHeaderBar";
import LiveMatchesCarousel from "../../components/LiveMatchesCarousel";

export default function Dashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const goPlayerTab = (routeName, params) => {
    const parent = navigation.getParent?.();
    if (parent) {
      if (params) parent.navigate(routeName, params);
      else parent.navigate(routeName);
    }
  };

  const stats = useMemo(() => {
    // Sample data until player dashboard API is wired on mobile.
    return {
      eventsParticipated: 0,
      wins: 0,
      rating: 0,
      achievements: 0,
    };
  }, []);

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-newsreader-bold text-neutral-900 dark:text-white">
                Player Dashboard
              </Text>
              <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
                Welcome{user?.firstName ? `, ${user.firstName}` : ""}! Find and participate in sports events.
              </Text>
            </View>

            <Pressable
              onPress={() => navigation.navigate(SCREENS.BookCourt)}
              accessibilityRole="button"
              className="h-10 flex-row items-center gap-2 rounded-2xl bg-primary px-4"
            >
              <Feather name="search" size={16} color="#fff" />
              <Text className="text-sm font-newsreader-bold text-white">Book Court</Text>
            </Pressable>
          </View>

          {/* Stats */}
          <View className="mt-5 flex-row flex-wrap gap-3">
            <View className="w-[48%] rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="text-3xl font-newsreader-bold text-primary">{stats.eventsParticipated}</Text>
              <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Events Participated</Text>
            </View>
            <View className="w-[48%] rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="text-3xl font-newsreader-bold text-emerald-600">{stats.wins}</Text>
              <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Wins</Text>
            </View>
            <View className="w-[48%] rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="text-3xl font-newsreader-bold text-secondary">{stats.rating}</Text>
              <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Rating</Text>
            </View>
            <View className="w-[48%] rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="text-3xl font-newsreader-bold text-purple-600">{stats.achievements}</Text>
              <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">Achievements</Text>
            </View>
          </View>

          {/* Upcoming events (sample) */}
          <View className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={18} color={isDark ? "rgba(249,250,251,0.9)" : "rgba(17,24,39,0.85)"} />
                <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">
                  Your Upcoming Events
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  goPlayerTab(SCREENS.EventsStack, { screen: SCREENS.EventsHome })
                }
                className="rounded-2xl bg-primary px-3 py-2"
                accessibilityRole="button"
              >
                <Text className="text-sm font-playfair font-semibold text-white">View all</Text>
              </Pressable>
            </View>

            <View className="mt-4 gap-3">
              <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Feather name="calendar" size={22} color={isDark ? "#93C5FD" : "#2563EB"} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">
                      No upcoming events yet
                    </Text>
                    <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/60">
                      Tap “Find Events” to register for your first event.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <LiveMatchesCarousel navigation={navigation} />

          {/* Quick actions */}
          <View className="mt-6">
            <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">Quick actions</Text>
            <View className="mt-3 flex-row flex-wrap gap-3">
              <Pressable
                onPress={() => navigation.navigate(SCREENS.AcademyStack)}
                className="w-[48%] items-center rounded-2xl border border-neutral-200 bg-white py-5 dark:border-white/10 dark:bg-white/5"
              >
                <Feather name="book-open" size={26} color={isDark ? "#60A5FA" : "#2563EB"} />
                <Text className="mt-2 text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                  Find Academies
                </Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate(SCREENS.PlayerFindCoach)}
                className="w-[48%] items-center rounded-2xl border border-neutral-200 bg-white py-5 dark:border-white/10 dark:bg-white/5"
              >
                <Feather name="search" size={26} color={isDark ? "#34D399" : "#059669"} />
                <Text className="mt-2 text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                  Find Coach
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
