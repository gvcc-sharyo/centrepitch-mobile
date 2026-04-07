import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import coachTeamService from "../../services/coachTeamService";
import eventService from "../../services/eventService";
import teamService from "../../services/teamService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function normalizeTeamList(raw) {
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  return [];
}

export default function TeamRegistration() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const eventId = route.params?.eventId ? String(route.params.eventId) : "";

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postPayStandardTeamId, setPostPayStandardTeamId] = useState(null);
  const [utrDraft, setUtrDraft] = useState("");
  const [utrNote, setUtrNote] = useState("");
  const [utrSubmitting, setUtrSubmitting] = useState(false);

  const role = String(user?.role || "player").toLowerCase();

  const ownerLabel = useMemo(() => {
    if (role === "academyadmin") return "Academy";
    if (role === "coach") return "Coach";
    return "Player";
  }, [role]);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const eventRes = await eventService.getEventById(eventId);
      const ev = eventRes?.data ?? eventRes;
      setEvent(ev);

      let list = [];
      if (role === "academyadmin") {
        const teamsRes = await teamService.getMyAcademyTeams();
        const body = teamsRes?.data ?? teamsRes;
        list = normalizeTeamList(body);
      } else if (role === "coach") {
        const r = await coachTeamService.getMyTeams();
        list = normalizeTeamList(r?.data);
      } else {
        const teamsRes = await teamService.getMyTeams();
        const body = teamsRes?.data ?? teamsRes;
        list = normalizeTeamList(body);
      }
      setTeams(list);
      if (list.length > 0) setTeamId(String(list[0]._id));
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load event or teams");
    } finally {
      setLoading(false);
    }
  }, [eventId, role]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFee = Number(event?.registrationFee || 0) > 0;

  const goToTeamsTab = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate(SCREENS.Teams);
    else navigation.goBack();
  };

  const handlePayAndRegister = async () => {
    if (!teamId) {
      toast.error("Please select a team");
      return;
    }
    setSubmitting(true);
    setPostPayStandardTeamId(null);
    try {
      const res = await teamService.checkoutRegisterTeamForEvent({ eventId, teamId });
      const payload = res?.data ?? res;
      if (payload?.registered) {
        toast.success("Team registered successfully!");
        goToTeamsTab();
        return;
      }
      if (payload?.checkoutUrl) {
        toast.success("Opening secure checkout…");
        await WebBrowser.openBrowserAsync(String(payload.checkoutUrl));
        return;
      }
      toast.error(payload?.message || "Could not start registration checkout");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to start pay-and-register");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterThenPayLater = async () => {
    if (!teamId) {
      toast.error("Please select a team");
      return;
    }
    setSubmitting(true);
    try {
      const res = await teamService.registerExistingTeamForEvent({ eventId, teamId });
      const payload = res?.data ?? res;
      const stdId = payload?.team?._id != null ? String(payload.team._id) : null;
      setPostPayStandardTeamId(stdId);
      setUtrDraft("");
      setUtrNote("");
      if (payload?.requiresPayment) {
        toast.success(
          "Team added with payment pending. Submit a reference below or pay via QR if shown."
        );
      } else {
        toast.success("Team registered successfully!");
        goToTeamsTab();
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to register team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUtr = async () => {
    if (!postPayStandardTeamId) return;
    if (!utrDraft.trim()) {
      toast.error("Enter UTR or transaction reference");
      return;
    }
    setUtrSubmitting(true);
    try {
      await eventService.submitTeamPaymentReference(eventId, {
        teamId: postPayStandardTeamId,
        utr: utrDraft.trim(),
        note: utrNote.trim(),
      });
      toast.success("Reference sent. The organizer will verify payment.");
      setUtrDraft("");
      setUtrNote("");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to submit reference");
    } finally {
      setUtrSubmitting(false);
    }
  };

  if (!eventId) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar title="Register team" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-newsreader-bold text-neutral-900 dark:text-white">Missing event</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Register team" />
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingHorizontal: 20,
            paddingTop: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => navigation.goBack()}
              className="rounded-full bg-neutral-100 p-2 dark:bg-white/10"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={20} color={isDark ? "#F9FAFB" : "#1F2B55"} />
            </Pressable>
            <Text className="flex-1 text-xl font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
              {event?.name || "Event"}
            </Text>
          </View>
          <Text className="mt-2 text-xs font-playfair uppercase text-neutral-500 dark:text-white/60">{ownerLabel}</Text>
          <Text className="mt-3 text-sm font-playfair leading-5 text-neutral-600 dark:text-white/70">
            {hasFee
              ? "Pay in checkout first (recommended), or register first and complete payment via QR / reference."
              : "No entry fee — confirm below to register your team."}
          </Text>

          {!!event?.qr_code_image && (
            <View className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Payment QR</Text>
              <Text className="mt-1 text-xs font-playfair text-neutral-600 dark:text-white/65">
                Use if you chose register first, pay later. Submit your reference below when done.
              </Text>
              <Image
                source={{ uri: event.qr_code_image }}
                className="mt-3 h-52 w-52 self-center rounded-xl bg-white"
                resizeMode="contain"
                accessibilityLabel="Payment QR code"
              />
            </View>
          )}

          {postPayStandardTeamId && hasFee ? (
            <View className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Payment pending</Text>
              <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
                Submit a transaction reference for the organizer.
              </Text>
              <TextInput
                value={utrDraft}
                onChangeText={setUtrDraft}
                placeholder="UPI or bank reference"
                placeholderTextColor="rgba(107,114,128,0.9)"
                className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 dark:border-white/15 dark:bg-[#1F2B55] dark:text-white"
              />
              <TextInput
                value={utrNote}
                onChangeText={setUtrNote}
                placeholder="Note (optional)"
                placeholderTextColor="rgba(107,114,128,0.9)"
                className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 dark:border-white/15 dark:bg-[#1F2B55] dark:text-white"
              />
              <Pressable
                onPress={handleSubmitUtr}
                disabled={utrSubmitting}
                className="mt-3 items-center rounded-2xl border border-primary py-3 opacity-100 disabled:opacity-50"
              >
                <Text className="font-newsreader-bold text-primary">
                  {utrSubmitting ? "Sending…" : "Send reference"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            {teams.length === 0 ? (
              <View className="items-center py-6">
                <Text className="text-center font-newsreader-bold text-neutral-900 dark:text-white">No teams available</Text>
                <Text className="mt-2 text-center text-sm font-playfair text-neutral-600 dark:text-white/65">
                  Create a team first, then return here.
                </Text>
                <Pressable onPress={goToTeamsTab} className="mt-4 rounded-2xl bg-primary px-5 py-3">
                  <Text className="font-newsreader-bold text-white">Go to Teams</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-3">
                <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">Select team</Text>
                <View className="flex-row flex-wrap gap-2">
                  {teams.map((t) => {
                    const id = String(t._id);
                    const selected = teamId === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => setTeamId(id)}
                        className={`rounded-2xl border px-3 py-2 ${
                          selected ? "border-primary bg-primary/10" : "border-neutral-200 dark:border-white/15"
                        }`}
                      >
                        <Text
                          className={`text-sm font-playfair ${selected ? "font-semibold text-primary" : "text-neutral-800 dark:text-white/85"}`}
                          numberOfLines={1}
                        >
                          {t.name || "Team"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={handlePayAndRegister}
                  disabled={submitting || !user}
                  className="mt-4 items-center rounded-2xl bg-primary py-3.5 opacity-100 disabled:opacity-45"
                >
                  <Text className="font-newsreader-bold text-white">
                    {submitting ? "Working…" : hasFee ? "Pay & register team" : "Register team"}
                  </Text>
                </Pressable>

                {hasFee ? (
                  <Pressable
                    onPress={handleRegisterThenPayLater}
                    disabled={submitting || !user}
                    className="items-center rounded-2xl border border-neutral-300 py-3 dark:border-white/20 opacity-100 disabled:opacity-45"
                  >
                    <Text className="font-newsreader-bold text-neutral-800 dark:text-white">Register first, pay later</Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={() => navigation.goBack()} className="items-center py-2">
                  <Text className="text-sm font-playfair text-neutral-600 dark:text-white/70">Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
