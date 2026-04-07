import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import organizerService from "../../services/organizerService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerEventScorers() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [event, setEvent] = useState(null);
  const [allScorers, setAllScorers] = useState([]);
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [evRes, scRes] = await Promise.all([
        eventService.getEventById(String(eventId)),
        organizerService.getScorers({ page: 1, limit: 100 }),
      ]);
      const ev = evRes?.data ?? evRes;
      setEvent(ev);
      const list = scRes?.data ?? [];
      setAllScorers(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load");
      setEvent(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    load();
  }, [eventId, load]);

  const staff = Array.isArray(event?.staff) ? event.staff : [];
  const assignedScorerIds = new Set(
    staff.filter((s) => s.role === "scorer" && s.user).map((s) => String(typeof s.user === "object" ? s.user._id : s.user))
  );

  const assign = async (scorerId) => {
    if (!eventId) return;
    setAssigning(scorerId);
    try {
      await organizerService.assignScorerToEvent(String(eventId), scorerId);
      toast.success("Scorer assigned");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not assign");
    } finally {
      setAssigning(null);
    }
  };

  const remove = async (scorerId) => {
    if (!eventId) return;
    setAssigning(scorerId);
    try {
      await organizerService.removeScorerFromEvent(String(eventId), scorerId);
      toast.success("Removed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not remove");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <OrganizerScreenShell title="Event scorers" scrollable={false}>
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading && !event ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={allScorers}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View className="mb-4">
              <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                Assign scorers to this event for live scoring. Create accounts from the Scorers screen if needed.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const id = String(item._id);
            const on = assignedScorerIds.has(id);
            return (
              <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <View className="mr-3 flex-1">
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">
                    {[item.firstName, item.lastName].filter(Boolean).join(" ")}
                  </Text>
                  <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">{item.email}</Text>
                </View>
                {on ? (
                  <Pressable
                    onPress={() => remove(id)}
                    disabled={assigning === id}
                    className="rounded-xl border border-red-400 px-3 py-2 dark:border-red-500/50"
                  >
                    <Text className="font-playfair text-sm text-red-600 dark:text-red-400">Remove</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => assign(id)}
                    disabled={assigning === id}
                    className="rounded-xl bg-primary px-3 py-2"
                  >
                    <Text className="font-playfair text-sm text-white">Assign</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="py-8 text-center font-playfair text-neutral-600 dark:text-white/60">
              No scorer accounts yet. Create one under Scorers in the menu.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </OrganizerScreenShell>
  );
}
