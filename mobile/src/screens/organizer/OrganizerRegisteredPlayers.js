import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const STATUSES = ["registered", "confirmed", "withdrawn", "disqualified"];

function rowLabel(row) {
  const p = row?.player;
  if (p && typeof p === "object") {
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "Player";
  }
  return "Player";
}

function playerUserId(row) {
  const p = row?.player;
  if (p && typeof p === "object" && p._id) return String(p._id);
  if (typeof p === "string") return p;
  return "";
}

export default function OrganizerRegisteredPlayers() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await eventService.getRegisteredPlayers(String(eventId));
      const list = res?.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load players");
      setRows([]);
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

  const setStatus = async (row, status) => {
    const pid = playerUserId(row);
    if (!eventId || !pid) {
      toast.error("Could not resolve player id for this row");
      return;
    }
    setUpdating(pid + status);
    try {
      await eventService.updatePlayerStatus(String(eventId), pid, status);
      toast.success("Status updated");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Update failed — legacy rows may need web admin");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <OrganizerScreenShell title="Registered players (API)" scrollable={false}>
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : (
        <>
          <Text className="mb-3 font-playfair text-sm text-neutral-600 dark:text-white/65">
            Data from GET /events/:id/players (legacy embedded or EventPlayerRegistration). Status updates use PUT
            /events/:id/players/:playerId with the user id when supported.
          </Text>
          {loading && rows.length === 0 ? (
            <View className="flex-1 items-center justify-center py-16">
              <ActivityIndicator color="#1F2B55" />
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item, index) => String(item._id || playerUserId(item) || index)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
              ListEmptyComponent={
                <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
                  No individual registrations for this event format.
                </Text>
              }
              renderItem={({ item }) => {
                const st = item.status || "—";
                const pid = playerUserId(item);
                return (
                  <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                    <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{rowLabel(item)}</Text>
                    <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">Status: {st}</Text>
                    <View className="mt-2 flex-row flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => setStatus(item, s)}
                          disabled={updating === pid + s}
                          className="rounded-lg border border-neutral-200 px-2 py-1 dark:border-white/15"
                        >
                          <Text className="font-playfair text-xs text-neutral-800 dark:text-white/85">{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </>
      )}
    </OrganizerScreenShell>
  );
}
