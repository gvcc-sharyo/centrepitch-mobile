import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import { TeamCard } from "../../components/common/TeamCard";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import organizerService from "../../services/organizerService";
import teamService from "../../services/teamService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function refId(ref) {
  if (!ref) return "";
  if (typeof ref === "object" && ref._id) return String(ref._id);
  return String(ref);
}

function canManageTeam(team, user) {
  if (!team || !user?._id) return false;
  const uid = String(user._id);
  const cap = refId(team.captain);
  const cr = refId(team.createdBy);
  if (cap === uid || cr === uid) return true;
  if (String(user.role || "").toLowerCase() === "superadmin") return true;
  return false;
}

function teamSportName(team) {
  return String(team?.sport?.name || team?.sportName || "").trim();
}

export default function OrganizerTeams() {
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const user = useSelector(selectUser);
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [sportPickerOpen, setSportPickerOpen] = useState(false);

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

  const sportOptions = useMemo(() => {
    const set = new Set();
    for (const t of teams) {
      const s = teamSportName(t);
      if (s) set.add(s);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return teams.filter((t) => {
      const name = String(t?.name || "").toLowerCase();
      const sport = teamSportName(t).toLowerCase();
      const type = String(t?.teamType || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || sport.includes(q) || type.includes(q);
      const matchesSport = sportFilter === "all" || sport === String(sportFilter).toLowerCase();
      return matchesSearch && matchesSport;
    });
  }, [search, sportFilter, teams]);

  const deleteTeam = (team) => {
    const id = String(team?._id || team?.id || "");
    if (!id) return;
    Alert.alert("Delete team", "This will remove the team. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await teamService.deleteTeam(id);
            toast.success("Team deleted");
            await load(true);
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not delete");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const id = String(item._id || item.id);
    const manage = canManageTeam(item, user);
    return (
      <TeamCard
        team={item}
        isDark={isDark}
        containerClassName={numColumns === 2 ? "mx-1.5 flex-1" : ""}
        canEdit={manage}
        onPress={() => navigation.navigate(SCREENS.OrganizerTeamDetail, { teamId: id })}
        onView={() => navigation.navigate(SCREENS.OrganizerTeamDetail, { teamId: id })}
        onManagePlayers={() => navigation.navigate(SCREENS.OrganizerTeamPlayers, { teamId: id })}
        onEdit={() => navigation.navigate(SCREENS.OrganizerEditTeam, { teamId: id })}
        onDelete={() => deleteTeam(item)}
      />
    );
  };

  return (
    <OrganizerScreenShell title="Teams" scrollable={false} showBack={false}>
      <View className="w-full max-w-[720px] flex-1 self-center">
        <Text className="mb-3 font-playfair text-sm text-neutral-500 dark:text-white/55">
          Create and manage your organizer teams
        </Text>

        <Pressable
          onPress={() => navigation.navigate(SCREENS.OrganizerCreateTeam)}
          className="mb-4 w-full flex-row items-center justify-center gap-2 rounded-xl bg-primary-800 px-5 py-3"
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text className="font-newsreader-bold text-white">Create Team</Text>
        </Pressable>

        <View className="mb-4 flex-row items-center gap-2">
          <View className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
            <View className="flex-row items-center gap-2">
              <Feather
                name="search"
                size={18}
                color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"}
              />
              <TextInput
                value={search}
                onChangeText={(t) => setSearch(t)}
                placeholder="Search teams..."
                placeholderTextColor={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.35)"}
                autoCapitalize="none"
                className="flex-1 font-playfair text-sm"
                style={{
                  flex: 1,
                  color: isDark ? "rgba(255,255,255,0.92)" : "rgba(17,24,39,0.92)",
                }}
                selectionColor={isDark ? "rgba(255,255,255,0.7)" : "rgba(31,43,85,0.6)"}
              />
            </View>
          </View>

          <Pressable
            onPress={() => setSportPickerOpen(true)}
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/5"
          >
            <View className="flex-row items-center gap-2">
              <Text className="font-newsreader-bold text-xs text-neutral-700 dark:text-white/75">
                {sportFilter === "all" ? "All Sports" : sportFilter}
              </Text>
              <Feather name="chevron-down" size={16} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"} />
            </View>
          </Pressable>
        </View>

        {loading && teams.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color="#1F2B55" />
          </View>
        ) : (
          <FlatList
            data={filteredTeams}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => String(item._id || item.id)}
            columnWrapperStyle={numColumns === 2 ? { paddingHorizontal: 4 } : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <View className="items-center rounded-2xl border border-dashed border-neutral-200 bg-white py-14 dark:border-white/15 dark:bg-white/5">
                <Feather name="users" size={40} color={isDark ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.25)"} />
                <Text className="mt-4 font-newsreader-bold text-lg text-neutral-900 dark:text-white">
                  {search || sportFilter !== "all" ? "No teams found" : "No teams yet"}
                </Text>
                <Text className="mt-2 px-6 text-center font-playfair text-sm text-neutral-500 dark:text-white/55">
                  {search || sportFilter !== "all"
                    ? "Try a different search or sport filter."
                    : "Create your first team to start inviting players."}
                </Text>
                {!search && sportFilter === "all" ? (
                  <Pressable
                    onPress={() => navigation.navigate(SCREENS.OrganizerCreateTeam)}
                    className="mt-6 rounded-2xl bg-primary px-5 py-3"
                  >
                    <Text className="font-newsreader-bold text-white">Create team</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setSearch("");
                      setSportFilter("all");
                    }}
                    className="mt-6 rounded-2xl bg-primary px-5 py-3"
                  >
                    <Text className="font-newsreader-bold text-white">Clear filters</Text>
                  </Pressable>
                )}
              </View>
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal visible={sportPickerOpen} transparent animationType="slide" onRequestClose={() => setSportPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setSportPickerOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Filter by sport</Text>
            <ScrollView className="mt-4" style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
              {sportOptions.map((s) => {
                const active = sportFilter === s;
                const label = s === "all" ? "All Sports" : s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setSportFilter(s);
                      setSportPickerOpen(false);
                    }}
                    className={`rounded-2xl border px-4 py-3 ${active
                        ? "border-primary bg-primary"
                        : "border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
                      }`}
                  >
                    <Text className={`font-newsreader-bold text-sm ${active ? "text-white" : "text-neutral-800 dark:text-white/80"}`}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => {
                setSportFilter("all");
                setSportPickerOpen(false);
              }}
              className="mt-4 items-center rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/10"
            >
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Clear sport filter</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
