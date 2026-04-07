import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import { SCREENS } from "../../constants/navigation";
import coachService from "../../services/coachService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function coachName(c) {
  const u = c?.userId || c?.user;
  const first = u?.firstName || c?.firstName || "";
  const last = u?.lastName || c?.lastName || "";
  const combined = `${first} ${last}`.trim();
  return combined || c?.displayName || "Coach";
}

function coachInitials(c) {
  const u = c?.userId || c?.user;
  const first = String(u?.firstName || c?.firstName || "").trim();
  const last = String(u?.lastName || c?.lastName || "").trim();
  const a = first.charAt(0) || "?";
  const b = last.charAt(0) || "";
  return `${a}${b}`.toUpperCase();
}

function coachAvatarUri(c) {
  const u = c?.userId;
  const fromUser = typeof u === "object" && u != null && u.profilePhoto ? u.profilePhoto : null;
  return c?.profilePhoto || fromUser || null;
}

/** Sports / specialization — "Badminton · Tennis" */
function coachSportsLine(c) {
  const spec = c?.specialization;
  if (Array.isArray(spec)) {
    const parts = spec
      .map((x) => (typeof x === "object" && x != null ? x.name || x.slug || "" : x))
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter(Boolean);
    return parts.join(" · ");
  }
  if (spec != null && String(spec).trim() !== "") return String(spec).trim();
  return "";
}

function coachExperienceLine(c) {
  const n = Number(c?.totalExperience);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "";
  return `${n} ${n === 1 ? "yr" : "yrs"} experience`;
}

export default function FindCoach() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [coaches, setCoaches] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: "APPROVED" };
      if (q.trim()) params.search = q.trim();
      const res = await coachService.getPublicCoaches(params);
      const raw = res.data?.data || res.data?.coaches || [];
      setCoaches(Array.isArray(raw) ? raw : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load coaches");
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCoach = (item) => {
    const id = item?._id || item?.id;
    if (!id) return;
    navigation.navigate(SCREENS.CoachScreen, { coachId: String(id) });
  };

  return (
    <PlayerScreenShell title="Find a coach" scrollable={false}>
      <View className="mb-3 flex-row items-center rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/15 dark:bg-white/5">
        <Feather name="search" size={18} color="rgba(107,114,128,0.9)" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or sport"
          placeholderTextColor="rgba(107,114,128,0.85)"
          className="ml-2 flex-1 py-3 font-playfair text-neutral-900 dark:text-white"
        />
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={(item, index) => String(item?._id || item?.id || index)}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="font-playfair text-neutral-600 dark:text-white/60">No coaches found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const uri = coachAvatarUri(item);
            const sports = coachSportsLine(item);
            const exp = coachExperienceLine(item);
            return (
              <Pressable
                onPress={() => openCoach(item)}
                className="mb-3 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
              >
                <View className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-emerald-700">
                  {uri ? (
                    <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Text className="font-newsreader-bold text-lg text-white">{coachInitials(item)}</Text>
                    </View>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-newsreader-bold text-base text-neutral-900 dark:text-white"
                    numberOfLines={1}
                  >
                    {coachName(item)}
                  </Text>
                  {sports ? (
                    <Text
                      className="mt-0.5 font-playfair text-sm text-neutral-600 dark:text-white/65"
                      numberOfLines={2}
                    >
                      {sports}
                    </Text>
                  ) : null}
                  {exp ? (
                    <Text className="mt-0.5 font-playfair text-xs text-neutral-500 dark:text-white/55" numberOfLines={1}>
                      {exp}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={20} color="rgba(107,114,128,0.65)" />
              </Pressable>
            );
          }}
        />
      )}
    </PlayerScreenShell>
  );
}
