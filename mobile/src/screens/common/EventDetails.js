import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import eventService from "../../services/eventService";
import { selectToken } from "../../store/slices/authSlice";
import { formatCurrency, formatDate, getErrorMessage, getEventStatus } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const HERO = require("../../../assets/public/bento_events_bg.png");

function statusStyles(status) {
  switch (status) {
    case "live":
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    case "completed":
      return "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/80";
    case "upcoming":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    default:
      return "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/80";
  }
}

export default function EventDetails() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const token = useSelector(selectToken);
  const eventId = route.params?.eventId;
  const organizerMode = Boolean(route.params?.organizerMode);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await eventService.getEventById(eventId);
      const data = res?.data ?? res;
      setEvent(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = event ? getEventStatus(event) : "";

  const handleJoinEvent = async () => {
    if (!eventId) return;
    setJoining(true);
    try {
      await eventService.registerForEvent(String(eventId));
      toast.success("You're registered!");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteEvent = () => {
    if (!eventId || deleting) return;
    Alert.alert(
      "Delete event",
      "This cannot be undone. Delete this event permanently?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await eventService.deleteEvent(String(eventId));
              toast.success("Event deleted");
              navigation.reset({
                index: 0,
                routes: [{ name: SCREENS.OrganizerMyEvents }],
              });
            } catch (e) {
              toast.error(getErrorMessage(e) || "Could not delete event");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar
        title="Event"
        {...(organizerMode
          ? {
              onPressNotifications: () =>
                navigation.navigate(SCREENS.OrganizerTabProfile, { screen: SCREENS.Notifications }),
            }
          : {})}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      ) : !event ? (
        <View className="flex-1 items-center justify-center px-6">
          <Feather name="calendar" size={48} color="rgba(255,255,255,0.35)" />
          <Text className="mt-4 text-center font-newsreader-bold text-neutral-900 dark:text-white">
            {eventId ? "Event not found" : "Missing event id"}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="h-48 overflow-hidden rounded-b-3xl bg-neutral-200 dark:bg-white/10">
            {event.bannerImages?.[0] ? (
              <ImageBackground
                source={{ uri: event.bannerImages[0] }}
                className="h-full w-full"
                resizeMode="cover"
              >
                <View className="flex-1 justify-end bg-black/35 p-5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className={`rounded-full px-3 py-1 ${statusStyles(status)}`}>
                      <Text className="text-xs font-newsreader-bold capitalize text-white">{status}</Text>
                    </View>
                    {event.sport?.name ? (
                      <View className="rounded-full bg-white/90 px-3 py-1">
                        <Text className="text-xs font-newsreader-bold text-neutral-900">{event.sport.name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <ImageBackground source={HERO} className="h-full w-full" resizeMode="cover">
                <View className="flex-1 justify-end bg-black/45 p-5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className={`rounded-full px-3 py-1 ${statusStyles(status)}`}>
                      <Text className="text-xs font-newsreader-bold capitalize text-white">{status}</Text>
                    </View>
                    {event.sport?.name ? (
                      <View className="rounded-full bg-white/90 px-3 py-1">
                        <Text className="text-xs font-newsreader-bold text-neutral-900">{event.sport.name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </ImageBackground>
            )}
          </View>

          <View className="px-5 pt-5">
            <Text className="text-2xl font-newsreader-bold text-neutral-900 dark:text-white">{event.name}</Text>
            {event.description ? (
              <Text className="mt-2 text-sm font-playfair leading-5 text-neutral-600 dark:text-white/70">
                {event.description}
              </Text>
            ) : null}

            <View className="mt-5 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <View className="flex-row items-center gap-3">
                <Feather name="calendar" size={18} color="#1F2B55" />
                <Text className="flex-1 text-sm font-playfair text-neutral-800 dark:text-white/85">
                  {formatDate(event.startDate, "MMM dd, yyyy")}
                  {event.endDate ? ` – ${formatDate(event.endDate, "MMM dd, yyyy")}` : ""}
                </Text>
              </View>
              {event.location?.city || event.location?.country ? (
                <View className="flex-row items-center gap-3">
                  <Feather name="map-pin" size={18} color="#1F2B55" />
                  <Text className="flex-1 text-sm font-playfair text-neutral-800 dark:text-white/85">
                    {[event.location?.city, event.location?.state, event.location?.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Feather name="dollar-sign" size={18} color="#1F2B55" />
                <Text className="text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                  {event.registrationFee > 0
                    ? formatCurrency(event.registrationFee, event.currency || "INR")
                    : "Free entry"}
                </Text>
              </View>
            </View>

            {organizerMode ? (
              <View className="mt-6 gap-3">
                <Pressable
                  onPress={() =>
                    navigation.navigate(SCREENS.OrganizerEditEvent, { eventId: String(eventId) })
                  }
                  accessibilityRole="button"
                  className="items-center rounded-2xl bg-primary py-3.5"
                >
                  <Text className="font-newsreader-bold text-white">Edit event</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate(SCREENS.OrganizerEventRegistrations, { eventId: String(eventId) })
                  }
                  accessibilityRole="button"
                  className="items-center rounded-2xl border border-neutral-300 py-3.5 dark:border-white/20"
                >
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Registrations</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate(SCREENS.OrganizerMatchSchedule, { eventId: String(eventId) })
                  }
                  accessibilityRole="button"
                  className="items-center rounded-2xl border border-neutral-300 py-3.5 dark:border-white/20"
                >
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Match schedule</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate(SCREENS.OrganizerRescheduleEvent, { eventId: String(eventId) })
                  }
                  accessibilityRole="button"
                  className="items-center rounded-2xl border border-neutral-300 py-3.5 dark:border-white/20"
                >
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Reschedule</Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteEvent}
                  disabled={deleting}
                  accessibilityRole="button"
                  className="items-center rounded-2xl border border-red-400 py-3.5 opacity-100 disabled:opacity-50 dark:border-red-500/60"
                >
                  <Text className="font-newsreader-bold text-red-600 dark:text-red-400">
                    {deleting ? "Deleting…" : "Delete event"}
                  </Text>
                </Pressable>
              </View>
            ) : token ? (
              <View className="mt-6 gap-3">
                <Pressable
                  onPress={handleJoinEvent}
                  disabled={joining}
                  accessibilityRole="button"
                  className="items-center rounded-2xl bg-primary py-3.5 opacity-100 disabled:opacity-50"
                >
                  <Text className="font-newsreader-bold text-white">
                    {joining ? "Joining…" : "Join this event"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate(SCREENS.TeamRegistration, { eventId: String(eventId) })
                  }
                  accessibilityRole="button"
                  className="items-center rounded-2xl border border-neutral-300 py-3.5 dark:border-white/20"
                >
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Register a team</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
