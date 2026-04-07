import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import PrimaryButton from "../../components/forms/PrimaryButton";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
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

export default function OrganizerEditTeam() {
  const route = useRoute();
  const navigation = useNavigation();
  const teamId = route.params?.teamId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamType, setTeamType] = useState("event_specific");
  const [gameFormat, setGameFormat] = useState("team");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await teamService.getTeamById(String(teamId));
      const t = res?.data ?? res;
      setName(t?.name || "");
      setDescription(t?.description || "");
      setTeamType(t?.teamType === "permanent" ? "permanent" : "event_specific");
      setGameFormat(["individual", "doubles", "team", "mixed_doubles"].includes(t?.gameFormat) ? t.gameFormat : "team");
      setContactEmail(t?.contactEmail || "");
      setContactPhone(t?.contactPhone || "");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load team");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [teamId, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!teamId || !name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await teamService.updateTeam(String(teamId), {
        name: name.trim(),
        description: description.trim() || "",
        teamType,
        gameFormat,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      toast.success("Team updated");
      navigation.goBack();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  if (!teamId) {
    return (
      <OrganizerScreenShell title="Edit team">
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing team.</Text>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title="Edit team">
      {loading ? (
        <View className="items-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <>
          <LabeledIconInput icon="users" label="Team name" required value={name} onChangeText={setName} />
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
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LabeledIconInput icon="phone" label="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
          <View className="mt-6">
            <PrimaryButton title="Save changes" isLoading={saving} onPress={save} />
          </View>
        </>
      )}
    </OrganizerScreenShell>
  );
}
