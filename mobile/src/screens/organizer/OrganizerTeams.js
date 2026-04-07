import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerTeams() {
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState([]);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await organizerService.getTeams({ page: 1, limit: 100 });
      const rows = res?.data ?? res?.teams ?? [];
      setTeams(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load teams");
      setTeams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const numColumns = width >= 700 ? 2 : 1;

  const renderItem = ({ item }) => {
    const id = String(item._id || item.id);
    const sportName = item.sport?.name || item.sportName || "";
    return (
      <Pressable
        onPress={() => navigation.navigate(SCREENS.OrganizerTeamDetail, { teamId: id })}
        className={`mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${
          numColumns === 2 ? "mx-1.5 flex-1" : ""
        }`}
      >
        <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white" numberOfLines={2}>
          {item.name || "Team"}
        </Text>
        {sportName ? (
          <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/60">{sportName}</Text>
        ) : null}
        {item.teamType ? (
          <View className="mt-2 flex-row items-center gap-1">
            <Feather name="tag" size={14} color={isDark ? "#93c5fd" : "#2563eb"} />
            <Text className="font-playfair text-xs text-neutral-500 dark:text-white/50">{item.teamType}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <OrganizerScreenShell title="Teams" scrollable={false} showBack={false}>
      <View className="w-full max-w-[720px] flex-1 self-center">
        <Pressable
          onPress={() => navigation.navigate(SCREENS.OrganizerCreateTeam)}
          className="mb-4 items-center rounded-2xl bg-primary py-3.5"
        >
          <Text className="font-newsreader-bold text-white">Create team</Text>
        </Pressable>
        {loading && teams.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color="#1F2B55" />
          </View>
        ) : (
          <FlatList
            data={teams}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => String(item._id || item.id)}
            columnWrapperStyle={numColumns === 2 ? { paddingHorizontal: 4 } : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
                No teams yet.
              </Text>
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </OrganizerScreenShell>
  );
}
