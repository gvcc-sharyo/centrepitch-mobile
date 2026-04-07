import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import sportService from "../../services/sportService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function formatBadges(formats) {
  if (!formats) return [];
  const out = [];
  if (formats.individual?.enabled) out.push("Individual");
  if (formats.doubles?.enabled) out.push("Doubles");
  if (formats.team?.enabled) out.push("Team");
  return out;
}

export default function Sports() {
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState([]);
  const [viewSport, setViewSport] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const iconColor = isDark ? "rgba(249,250,251,0.85)" : "rgba(17,24,39,0.75)";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sportService.getSports({ page: 1, limit: 100 });
      const rows = res?.data ?? [];
      setSports(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load sports");
      setSports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (sport) => {
    const id = String(sport._id || sport.id);
    const name = sport.name || "this sport";
    Alert.alert(
      "Delete configuration",
      `Remove configuration for "${name}"? This cannot be undone if the sport is in use.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await sportService.deleteOwnPublicSport(id);
              toast.success("Deleted");
              setViewSport(null);
              load();
            } catch (e) {
              toast.error(getErrorMessage(e) || "Could not delete");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <OrganizerScreenShell title="Sports configuration">
      <Text className="mb-3 font-playfair text-sm text-neutral-600 dark:text-white/65">
        Add sports under your organization profile on the web first, then configure formats and rules here — same flow as
        the web organizer dashboard.
      </Text>

      <Pressable
        onPress={() => navigation.navigate(SCREENS.OrganizerSportConfiguration, { mode: "create" })}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3"
      >
        <Feather name="plus-circle" size={20} color="#fff" />
        <Text className="font-newsreader-bold text-white">Add configuration</Text>
      </Pressable>

      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <View className="gap-3">
          {sports.map((s) => {
            const sid = String(s._id || s.id);
            const badges = formatBadges(s.formats);
            return (
              <View
                key={sid}
                className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <View className="flex-row items-start gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    {s.icon ? (
                      <Image source={{ uri: s.icon }} className="h-8 w-8" resizeMode="contain" />
                    ) : (
                      <Feather name="award" size={24} color="#1F2B55" />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
                      {s.name}
                    </Text>
                    {s.description ? (
                      <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/55" numberOfLines={2}>
                        {s.description}
                      </Text>
                    ) : null}
                    <View className="mt-2 flex-row flex-wrap gap-1">
                      {badges.length ? (
                        badges.map((b) => (
                          <View key={b} className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-white/10">
                            <Text className="font-playfair text-[10px] text-neutral-700 dark:text-white/80">{b}</Text>
                          </View>
                        ))
                      ) : (
                        <Text className="font-playfair text-xs text-neutral-400">No formats enabled</Text>
                      )}
                    </View>
                  </View>
                </View>

                <View className="mt-4 flex-row gap-2 border-t border-neutral-100 pt-3 dark:border-white/10">
                  <Pressable
                    onPress={() => setViewSport(s)}
                    className="flex-1 items-center rounded-xl border border-neutral-200 py-2 dark:border-white/15"
                  >
                    <Text className="font-playfair text-sm text-neutral-800 dark:text-white">View</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate(SCREENS.OrganizerSportConfiguration, { mode: "edit", sportId: sid })
                    }
                    className="flex-1 items-center rounded-xl bg-primary py-2"
                  >
                    <Text className="font-playfair text-sm text-white">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(s)}
                    disabled={deletingId === sid}
                    className="items-center justify-center rounded-xl border border-red-200 px-3 py-2 dark:border-red-500/40"
                  >
                    {deletingId === sid ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
          {sports.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-neutral-200 py-10 dark:border-white/15">
              <Feather name="layers" size={40} color={iconColor} />
              <Text className="mt-3 text-center font-playfair text-neutral-600 dark:text-white/60">
                No saved configurations yet. Add your catalog sports on the web, then tap Add configuration.
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Modal visible={!!viewSport} animationType="slide" transparent onRequestClose={() => setViewSport(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="absolute inset-0" onPress={() => setViewSport(null)} accessibilityLabel="Dismiss" />
          <View className="max-h-[85%] rounded-t-3xl bg-white dark:bg-[#1F2B55]">
            <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
              <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white" numberOfLines={1}>
                {viewSport?.name}
              </Text>
              <Pressable onPress={() => setViewSport(null)} accessibilityLabel="Close">
                <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
              </Pressable>
            </View>
            <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
              {viewSport?.description ? (
                <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/70">{viewSport.description}</Text>
              ) : null}
              {viewSport?.formats?.team?.enabled ? (
                <View className="mb-4 rounded-xl bg-neutral-50 p-3 dark:bg-white/5">
                  <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">Team format</Text>
                  <Text className="font-playfair text-xs text-neutral-600 dark:text-white/65">
                    Playing {viewSport.formats.team.playingCount ?? "—"} + {viewSport.formats.team.substitutesCount ?? "—"}{" "}
                    subs · Roster {viewSport.formats.team.minPlayersPerTeam ?? "—"}–{viewSport.formats.team.maxPlayersPerTeam ?? "—"}
                  </Text>
                </View>
              ) : null}
              {viewSport?.categories?.length ? (
                <Text className="mb-2 font-playfair text-sm text-neutral-700 dark:text-white/75">
                  {viewSport.categories.length} categories
                </Text>
              ) : null}
              {viewSport?.matchSettings ? (
                <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                  Match ~{viewSport.matchSettings.defaultDuration ?? "—"} min · {viewSport.matchSettings.periods ?? "—"} periods
                </Text>
              ) : null}
              {viewSport?.rules?.summary ? (
                <Text className="mt-4 font-playfair text-sm text-neutral-700 dark:text-white/75">{viewSport.rules.summary}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </OrganizerScreenShell>
  );
}
