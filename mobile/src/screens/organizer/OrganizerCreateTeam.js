import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import PrimaryButton from "../../components/forms/PrimaryButton";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import sportService from "../../services/sportService";
import teamService from "../../services/teamService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const TEAM_TYPES = [
  { value: "event_specific", label: "Event-specific" },
  { value: "permanent", label: "Permanent" },
];

const GAME_FORMATS = [
  { value: "team", label: "Team" },
  { value: "individual", label: "Individual" },
  { value: "doubles", label: "Doubles" },
  { value: "mixed_doubles", label: "Mixed doubles" },
];

export default function OrganizerCreateTeam() {
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [sportModal, setSportModal] = useState(false);
  const [sportId, setSportId] = useState("");
  const [sportLabel, setSportLabel] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamType, setTeamType] = useState("event_specific");
  const [gameFormat, setGameFormat] = useState("team");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSports = useCallback(async () => {
    setLoadingSports(true);
    try {
      const res = await sportService.getSports({ page: 1, limit: 200, isActive: true });
      const rows = res?.data ?? [];
      setSports(Array.isArray(rows) ? rows : []);
    } catch {
      setSports([]);
      toast.error("Could not load sports");
    } finally {
      setLoadingSports(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSports();
    }, [loadSports])
  );

  /** Team.sport must be the Sport model id. Organizer GET /sports may return configs: use `sport`, else row id (catalog). */
  const resolveSportId = (s) => {
    const ref = s?.sport;
    if (ref && typeof ref === "object" && ref._id) return String(ref._id);
    if (ref) return String(ref);
    return String(s?._id || s?.id || "");
  };

  const sportRowLabel = (s) => s?.name || (typeof s?.sport === "object" && s?.sport?.name) || "";

  const pickSport = (s) => {
    setSportId(resolveSportId(s));
    setSportLabel(sportRowLabel(s) || resolveSportId(s));
    setSportModal(false);
  };

  const goToSportsConfiguration = () => {
    setSportModal(false);
    navigation.navigate(SCREENS.OrganizerTabHome, { screen: SCREENS.OrganizerSports });
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }
    if (!sportId) {
      toast.error("Select a sport");
      return;
    }
    setSubmitting(true);
    try {
      const res = await teamService.createTeam({
        name: name.trim(),
        sport: sportId,
        sportName: sportLabel || "",
        description: description.trim() || undefined,
        teamType,
        gameFormat,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      const created = res?.data ?? res;
      const tid = created?._id || created?.id;
      toast.success("Team created");
      if (tid) {
        navigation.replace(SCREENS.OrganizerTeamDetail, { teamId: String(tid) });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not create team");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <OrganizerScreenShell title="Create team">
      {loadingSports ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <>
          <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/65">
            Creates an empty roster you can fill by inviting players or adding members by user id (same as web organizer
            flow).
          </Text>
          {sports.length === 0 ? (
            <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/35 dark:bg-amber-500/10">
              <Text className="font-playfair text-sm text-amber-950 dark:text-amber-100">
                No sports are set up for your organizer account yet. Add catalog sports under Profile → Organization, then
                use Sports configuration for formats. You can open either below.
              </Text>
              <Pressable onPress={goToSportsConfiguration} className="mt-3 items-center rounded-2xl bg-primary py-3">
                <Text className="font-newsreader-bold text-white">Sports configuration</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate(SCREENS.OrganizerTabProfile, { screen: SCREENS.OrganizerProfileHome })}
                className="mt-2 items-center rounded-2xl border border-amber-300 bg-white py-3 dark:border-amber-500/50 dark:bg-amber-950/20"
              >
                <Text className="font-newsreader-bold text-amber-950 dark:text-amber-100">Organization profile</Text>
              </Pressable>
            </View>
          ) : null}
          <LabeledIconInput icon="users" label="Team name" required value={name} onChangeText={setName} placeholder="e.g. North Stars" />
          <Text className="mb-1 mt-3 font-playfair text-sm text-neutral-600 dark:text-white/60">Sport *</Text>
          <Pressable
            onPress={() => setSportModal(true)}
            className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
          >
            <Text className="font-playfair text-base text-neutral-900 dark:text-white">{sportLabel || "Tap to choose sport"}</Text>
            <Feather name="chevron-down" size={20} color={isDark ? "#fff" : "#111"} />
          </Pressable>
          <Text className="mb-1 mt-3 font-playfair text-sm text-neutral-600 dark:text-white/60">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={ph}
            multiline
            textAlignVertical="top"
            className={`min-h-[88px] ${inputClass}`}
          />
          <Text className="mb-2 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Team type</Text>
          <View className="flex-row flex-wrap gap-2">
            {TEAM_TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setTeamType(t.value)}
                className={`rounded-full px-4 py-2 ${teamType === t.value ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
              >
                <Text className={`font-playfair text-sm ${teamType === t.value ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-2 mt-4 font-playfair text-sm text-neutral-600 dark:text-white/60">Game format</Text>
          <View className="flex-row flex-wrap gap-2">
            {GAME_FORMATS.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setGameFormat(t.value)}
                className={`rounded-full px-3 py-2 ${gameFormat === t.value ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
              >
                <Text className={`font-playfair text-xs ${gameFormat === t.value ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <LabeledIconInput
            icon="mail"
            label="Contact email"
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="Optional"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LabeledIconInput icon="phone" label="Contact phone" value={contactPhone} onChangeText={setContactPhone} placeholder="Optional" keyboardType="phone-pad" />
          <View className="mt-6">
            <PrimaryButton title="Create team" isLoading={submitting} onPress={submit} />
          </View>
        </>
      )}

      <Modal visible={sportModal} animationType="slide" transparent onRequestClose={() => setSportModal(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setSportModal(false)}>
          <View className="max-h-[70%] rounded-t-3xl bg-white dark:bg-[#1F2B55]">
            <Text className="border-b border-neutral-200 px-4 py-3 font-newsreader-bold text-lg text-neutral-900 dark:border-white/10 dark:text-white">
              Select sport
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" className="px-2 py-2">
              {sports.length === 0 ? (
                <View className="px-3 py-6">
                  <Text className="text-center font-playfair text-sm text-neutral-600 dark:text-white/65">
                    No sports available. Configure sports for your account first.
                  </Text>
                  <Pressable onPress={goToSportsConfiguration} className="mt-4 items-center rounded-2xl bg-primary py-3">
                    <Text className="font-newsreader-bold text-white">Sports configuration</Text>
                  </Pressable>
                </View>
              ) : (
                sports.map((s) => (
                  <Pressable
                    key={String(s._id || resolveSportId(s))}
                    onPress={() => pickSport(s)}
                    className="rounded-xl px-3 py-3 active:bg-neutral-100 dark:active:bg-white/10"
                  >
                    <Text className="font-playfair text-base text-neutral-900 dark:text-white">{sportRowLabel(s) || "—"}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
