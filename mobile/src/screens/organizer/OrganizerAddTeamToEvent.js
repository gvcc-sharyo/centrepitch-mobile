import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import organizerService from "../../services/organizerService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerAddTeamToEvent() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState([]);
  const [registeredTeamIds, setRegisteredTeamIds] = useState(new Set());
  const [adding, setAdding] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [teamsRes, evRes] = await Promise.all([
        organizerService.getTeams({ page: 1, limit: 200 }),
        eventService.getEventById(String(eventId)),
      ]);
      const trows = teamsRes?.data ?? [];
      setTeams(Array.isArray(trows) ? trows : []);
      const ev = evRes?.data ?? evRes;
      const regs = Array.isArray(ev?.registeredTeams) ? ev.registeredTeams : [];
      const ids = new Set(
        regs.filter((r) => r.status !== "withdrawn").map((r) => String(r.team?._id || r.team))
      );
      setRegisteredTeamIds(ids);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load");
      setTeams([]);
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

  const add = async (teamId) => {
    if (!eventId) return;
    setAdding(teamId);
    try {
      await organizerService.addTeamToEvent(String(eventId), teamId);
      toast.success("Team added to event");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not add team");
    } finally {
      setAdding(null);
    }
  };

  const data = useMemo(() => teams, [teams]);

  return (
    <OrganizerScreenShell title="Add team to event" scrollable={false}>
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading && teams.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <Text className="mb-3 font-playfair text-sm text-neutral-600 dark:text-white/65">
              Registers your team for this event (same as web). Teams already active on the event are disabled.
            </Text>
          }
          renderItem={({ item }) => {
            const id = String(item._id);
            const already = registeredTeamIds.has(id);
            return (
              <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <View className="mr-3 flex-1">
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{item.name || "Team"}</Text>
                  {item.sport?.name ? (
                    <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">{item.sport.name}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => add(id)}
                  disabled={already || adding === id}
                  className={`rounded-xl px-3 py-2 ${already ? "bg-neutral-200 dark:bg-white/10" : "bg-primary"}`}
                >
                  <Text className={`font-playfair text-sm ${already ? "text-neutral-500" : "text-white"}`}>
                    {already ? "Added" : adding === id ? "…" : "Add"}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text className="py-8 text-center font-playfair text-neutral-600 dark:text-white/60">No teams found.</Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </OrganizerScreenShell>
  );
}
