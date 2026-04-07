import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import organizerService from "../../services/organizerService";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function normalizeSchedulePayload(res) {
  const raw = res?.data ?? res;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.schedule)) return raw.schedule;
  return [];
}

function labelSide(m, key) {
  const side = m[key];
  if (!side) return "TBD";
  if (typeof side === "object") {
    if (side.name) return side.name;
    if (side.firstName || side.lastName) return [side.firstName, side.lastName].filter(Boolean).join(" ");
  }
  return "…";
}

export default function MatchSchedule() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.85)" : "rgba(17,24,39,0.8)";

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [eventMeta, setEventMeta] = useState(null);
  const [participants, setParticipants] = useState({ teams: [], players: [], gameFormat: "" });

  const [roundModal, setRoundModal] = useState(false);
  const [roundName, setRoundName] = useState("Round 1");

  const [matchModal, setMatchModal] = useState(false);
  const [matchRound, setMatchRound] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [venue, setVenue] = useState("");
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);

  const [resultModal, setResultModal] = useState(null);
  const [score, setScore] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [matchStatus, setMatchStatus] = useState("completed");
  const [savingResult, setSavingResult] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [schRes, evRes, partRes] = await Promise.all([
        organizerService.getEventSchedule(String(eventId)),
        eventService.getEventById(String(eventId)),
        organizerService.getParticipantsForScheduling(String(eventId)),
      ]);
      setSchedule(normalizeSchedulePayload(schRes));
      const ev = evRes?.data ?? evRes;
      setEventMeta(ev);
      const p = partRes?.data ?? partRes;
      setParticipants({
        teams: Array.isArray(p?.teams) ? p.teams : [],
        players: Array.isArray(p?.players) ? p.players : [],
        gameFormat: p?.gameFormat || ev?.gameFormat || "",
      });
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load schedule");
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const gameFormat = participants.gameFormat || eventMeta?.gameFormat || "team";

  const roundNames = useMemo(() => schedule.map((r) => r.round).filter(Boolean), [schedule]);

  const createRound = async () => {
    if (!eventId || !roundName.trim()) return;
    try {
      await organizerService.createRound(String(eventId), roundName.trim());
      toast.success("Round created");
      setRoundModal(false);
      setRoundName("Round 1");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not create round");
    }
  };

  const submitMatch = async () => {
    if (!eventId || !matchRound.trim() || !dateTime.trim()) {
      toast.error("Round and date/time are required (ISO format recommended).");
      return;
    }
    const payload = {
      roundName: matchRound.trim(),
      dateTime: new Date(dateTime).toISOString(),
      venue: venue.trim() || undefined,
    };
    try {
      if (gameFormat === "individual") {
        payload.player1Id = a1;
        payload.player2Id = a2;
      } else {
        payload.team1Id = a1;
        payload.team2Id = a2;
      }
      setSavingMatch(true);
      await organizerService.createMatch(String(eventId), payload);
      toast.success("Match created");
      setMatchModal(false);
      setVenue("");
      setA1("");
      setA2("");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not create match");
    } finally {
      setSavingMatch(false);
    }
  };

  const removeMatch = (roundLabel, matchId) => {
    if (!eventId || !matchId) return;
    Alert.alert("Delete match", "Remove this match?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await organizerService.deleteMatch(String(eventId), String(matchId), roundLabel);
            toast.success("Deleted");
            load();
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not delete");
          }
        },
      },
    ]);
  };

  const saveResult = async () => {
    if (!resultModal || !eventId) return;
    const { matchId, roundLabel } = resultModal;
    setSavingResult(true);
    try {
      await organizerService.updateMatchResult(String(eventId), String(matchId), {
        roundName: roundLabel,
        score: score.trim(),
        winnerId: winnerId.trim() || undefined,
        status: matchStatus,
      });
      toast.success("Result saved");
      setResultModal(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not save result");
    } finally {
      setSavingResult(false);
    }
  };

  const openResult = (roundLabel, m) => {
    const matchId = String(m._id);
    setScore(m?.result?.score || "");
    setWinnerId(
      m?.result?.winner?._id
        ? String(m.result.winner._id)
        : m?.result?.winner
        ? String(m.result.winner)
        : ""
    );
    setMatchStatus(m?.result?.status || "scheduled");
    setResultModal({ matchId, roundLabel, m });
  };

  const pickers = useMemo(() => {
    const teamOpts = participants.teams.map((t) => ({
      id: String(t._id),
      label: t.name || "Team",
    }));
    const playerOpts = participants.players.map((p) => ({
      id: String(p._id),
      label: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Player",
    }));
    return gameFormat === "team" || gameFormat === "doubles" ? teamOpts : playerOpts;
  }, [participants, gameFormat]);

  return (
    <OrganizerScreenShell title="Match schedule">
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <ScrollView className="w-full max-w-[720px] self-center" keyboardShouldPersistTaps="handled">
          <View className="mb-4 flex-row gap-2">
            <Pressable onPress={() => setRoundModal(true)} className="flex-1 items-center rounded-2xl bg-primary py-3">
              <Text className="font-newsreader-bold text-white">Add round</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMatchRound(roundNames[0] || "Round 1");
                setMatchModal(true);
              }}
              className="flex-1 items-center rounded-2xl border border-neutral-300 py-3 dark:border-white/20"
            >
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Add match</Text>
            </Pressable>
          </View>
          <Text className="mb-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
            Format: {gameFormat}. Participants must be registered on the event. Use ISO date-time when adding matches
            (e.g. copy from a converter).
          </Text>

          {schedule.length === 0 ? (
            <View className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <Feather name="calendar" size={36} color={iconColor} style={{ alignSelf: "center" }} />
              <Text className="mt-3 text-center font-playfair text-neutral-600 dark:text-white/65">
                No schedule yet. Add a round, then add matches.
              </Text>
              <Pressable onPress={load} className="mt-4 items-center rounded-2xl bg-primary py-3">
                <Text className="font-newsreader-bold text-white">Refresh</Text>
              </Pressable>
            </View>
          ) : (
            schedule.map((round) => (
              <View
                key={String(round.round)}
                className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">{round.round}</Text>
                {(round.matches || []).map((m) => {
                  const t1 = gameFormat === "team" || (gameFormat === "doubles" && m.team1) ? labelSide(m, "team1") : labelSide(m, "player1");
                  const t2 = gameFormat === "team" || (gameFormat === "doubles" && m.team2) ? labelSide(m, "team2") : labelSide(m, "player2");
                  return (
                    <View key={String(m._id)} className="mt-3 border-t border-neutral-100 pt-3 dark:border-white/10">
                      <Text className="font-playfair text-sm text-neutral-800 dark:text-white/85">
                        {t1} vs {t2}
                      </Text>
                      {m.dateTime ? (
                        <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
                          {formatDate(m.dateTime, "MMM dd, yyyy HH:mm")}
                        </Text>
                      ) : null}
                      {m.venue ? (
                        <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">{m.venue}</Text>
                      ) : null}
                      {m?.result?.score ? (
                        <Text className="mt-1 font-playfair text-xs text-primary">Score: {m.result.score}</Text>
                      ) : null}
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => openResult(round.round, m)}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 dark:bg-white/10"
                        >
                          <Text className="font-playfair text-xs text-neutral-900 dark:text-white">Result</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeMatch(round.round, m._id)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 dark:border-red-500/40"
                        >
                          <Text className="font-playfair text-xs text-red-600 dark:text-red-400">Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={roundModal} transparent animationType="fade" onRequestClose={() => setRoundModal(false)}>
        <Pressable className="flex-1 justify-center bg-black/50 px-4" onPress={() => setRoundModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-2xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">New round name</Text>
            <TextInput
              value={roundName}
              onChangeText={setRoundName}
              className="mt-3 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Pressable onPress={createRound} className="mt-4 items-center rounded-xl bg-primary py-3">
              <Text className="font-newsreader-bold text-white">Create</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={matchModal} transparent animationType="slide" onRequestClose={() => setMatchModal(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setMatchModal(false)}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            className="max-h-[85%] rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]"
          >
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">New match</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">Round name</Text>
            <TextInput
              value={matchRound}
              onChangeText={setMatchRound}
              placeholder="Round 1"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Side A id / Side B id (team or player Mongo id)
            </Text>
            <TextInput
              value={a1}
              onChangeText={setA1}
              placeholder="Participant A id"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair text-xs dark:border-white/10 dark:text-white"
            />
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
              Quick picks: {pickers.slice(0, 4).map((p) => p.label).join(" · ")}
              {pickers.length > 4 ? "…" : ""}
            </Text>
            <TextInput
              value={a2}
              onChangeText={setA2}
              placeholder="Participant B id"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair text-xs dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Date/time (ISO)</Text>
            <TextInput
              value={dateTime}
              onChangeText={setDateTime}
              placeholder="2026-04-15T10:00:00.000Z"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Venue (optional)</Text>
            <TextInput
              value={venue}
              onChangeText={setVenue}
              placeholder="Court 1"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Pressable
              onPress={submitMatch}
              disabled={savingMatch}
              className="mt-5 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {savingMatch ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Save match</Text>}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(resultModal)} transparent animationType="fade" onRequestClose={() => setResultModal(null)}>
        <Pressable className="flex-1 justify-center bg-black/50 px-4" onPress={() => setResultModal(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-2xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Match result</Text>
            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">Score</Text>
            <TextInput
              value={score}
              onChangeText={setScore}
              placeholder="e.g. 2-1"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Winner id (team or player)</Text>
            <TextInput
              value={winnerId}
              onChangeText={setWinnerId}
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 font-playfair dark:border-white/10 dark:text-white"
            />
            <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Status</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {["scheduled", "in_progress", "completed", "cancelled"].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setMatchStatus(s)}
                  className={`rounded-full px-3 py-1 ${matchStatus === s ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
                >
                  <Text className={`font-playfair text-xs ${matchStatus === s ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={saveResult} disabled={savingResult} className="mt-4 items-center rounded-xl bg-primary py-3 disabled:opacity-50">
              {savingResult ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Save</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
