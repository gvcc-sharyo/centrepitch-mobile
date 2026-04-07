import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerCoachTeams() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await organizerService.getCoachTeams({ page: 1, limit: 100 });
      const list = res?.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load coach teams");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const numColumns = width >= 700 ? 2 : 1;

  return (
    <OrganizerScreenShell title="Coach teams" scrollable={false}>
      <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
          Teams created under coaching programs linked to your organizer account (read-only list; roster edits stay on
          web).
        </Text>
      </View>
      {loading && rows.length === 0 ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={rows}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => String(item._id || item.id)}
          columnWrapperStyle={numColumns === 2 ? { paddingHorizontal: 4 } : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">No coach teams found.</Text>
          }
          renderItem={({ item }) => (
            <View
              className={`mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${
                numColumns === 2 ? "mx-1.5 flex-1" : ""
              }`}
            >
              <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white">
                {item.name || item.teamName || "Team"}
              </Text>
              {item.sport?.name ? (
                <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/60">{item.sport.name}</Text>
              ) : null}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </OrganizerScreenShell>
  );
}
