import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function toDateInput(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function OrganizerRescheduleEvent() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [eventName, setEventName] = useState("");

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await eventService.getEventById(String(eventId));
      const ev = res?.data ?? res;
      setEventName(ev?.name || "");
      setStartDate(toDateInput(ev?.startDate));
      setEndDate(toDateInput(ev?.endDate));
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!eventId) return;
    if (!startDate || !endDate) {
      toast.error("Start and end dates are required");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please add a short reason for participants");
      return;
    }
    setSaving(true);
    try {
      const start = new Date(`${startDate}T12:00:00`);
      const end = new Date(`${endDate}T12:00:00`);
      if (end <= start) {
        toast.error("End date must be after start date");
        setSaving(false);
        return;
      }
      await eventService.rescheduleEvent(String(eventId), {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        reason: reason.trim(),
      });
      toast.success("Event rescheduled");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  if (!eventId) {
    return (
      <OrganizerScreenShell title="Reschedule">
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title="Reschedule event" scrollable={false}>
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {eventName ? (
            <Text className="mb-4 font-newsreader-semibold text-neutral-800 dark:text-white/90">{eventName}</Text>
          ) : null}
          <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">New start (YYYY-MM-DD)</Text>
          <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-06-01" placeholderTextColor={ph} className={inputClass} />
          <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">New end (YYYY-MM-DD)</Text>
          <TextInput value={endDate} onChangeText={setEndDate} placeholder="2026-06-02" placeholderTextColor={ph} className={inputClass} />
          <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/55">Reason (sent to registered players)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Venue change, weather, etc."
            placeholderTextColor={ph}
            multiline
            className={`min-h-[100px] ${inputClass}`}
            textAlignVertical="top"
          />
          <Pressable
            onPress={save}
            disabled={saving}
            className="mt-6 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
          >
            <Text className="font-newsreader-bold text-white">{saving ? "Saving…" : "Save new dates"}</Text>
          </Pressable>
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
