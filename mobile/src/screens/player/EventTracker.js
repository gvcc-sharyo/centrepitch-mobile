import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import { SCREENS } from "../../constants/navigation";
import playerService from "../../services/playerService";
import eventService from "../../services/eventService";
import { formatDate, getErrorMessage, getEventStatus } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function EventTracker() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await playerService.getEventTracker();
      const list = Array.isArray(res?.data) ? res.data : res?.data?.data ?? [];
      setEvents(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load tracker");
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const openEvent = (id) => {
    if (!id) return;
    navigation.navigate(SCREENS.EventDetails, { eventId: String(id) });
  };

  const withdraw = async (id) => {
    try {
      await eventService.withdrawFromEvent(id);
      toast.success("Withdrawn");
      load(true);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not withdraw");
    }
  };

  return (
    <PlayerScreenShell title="Event tracker" scrollable={false}>
      {loading && events.length === 0 ? (
        <View className="flex-1 items-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
              No upcoming or live registered events.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const lifecycle = getEventStatus(item);
            const days = item.daysUntilEvent;
            return (
              <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Pressable onPress={() => openEvent(item._id)}>
                  <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                    {formatDate(item.startDate)} · {item.sport?.name || "Sport"}
                  </Text>
                  <Text className="mt-2 font-playfair text-xs text-primary">
                    {lifecycle}
                    {typeof days === "number" ? ` · ${days} day(s) to go` : ""}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => withdraw(item._id)}
                  className="mt-3 self-start rounded-lg border border-red-200 px-3 py-1.5 dark:border-red-800"
                >
                  <Text className="font-playfair text-xs text-red-700 dark:text-red-200">Withdraw</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </PlayerScreenShell>
  );
}
