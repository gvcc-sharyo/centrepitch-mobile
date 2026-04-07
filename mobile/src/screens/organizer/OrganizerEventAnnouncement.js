import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerEventAnnouncement() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    if (!eventId || !title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending(true);
    try {
      await organizerService.sendEventAnnouncement(String(eventId), {
        title: title.trim(),
        message: message.trim(),
        priority,
        includeWithdrawn,
      });
      toast.success("Announcement sent");
      setTitle("");
      setMessage("");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not send");
    } finally {
      setSending(false);
    }
  }, [eventId, title, message, priority, includeWithdrawn]);

  return (
    <OrganizerScreenShell title="Announcement">
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : (
        <ScrollView className="w-full max-w-[720px] self-center" keyboardShouldPersistTaps="handled">
          <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/65">
            Sends an in-app notification to registered players and team contacts, and email to staff without an
            account (same as web).
          </Text>
          <Text className="font-playfair text-xs uppercase text-neutral-500 dark:text-white/50">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Venue change"
            placeholderTextColor="rgba(107,114,128,0.9)"
            className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <Text className="mt-4 font-playfair text-xs uppercase text-neutral-500 dark:text-white/50">Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Your message…"
            multiline
            textAlignVertical="top"
            placeholderTextColor="rgba(107,114,128,0.9)"
            className="mt-1 min-h-[120px] rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <Text className="flex-1 font-playfair text-sm text-neutral-800 dark:text-white/85">
              Include withdrawn registrations
            </Text>
            <Switch value={includeWithdrawn} onValueChange={setIncludeWithdrawn} />
          </View>
          <Text className="mt-4 font-playfair text-xs uppercase text-neutral-500 dark:text-white/50">Priority</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {["low", "medium", "high"].map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                className={`rounded-full px-4 py-2 ${
                  priority === p ? "bg-primary" : "border border-neutral-200 dark:border-white/15"
                }`}
              >
                <Text
                  className={`font-playfair text-sm capitalize ${
                    priority === p ? "text-white" : "text-neutral-800 dark:text-white/85"
                  }`}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={send}
            disabled={sending}
            className="mt-6 items-center rounded-2xl bg-primary py-3.5 opacity-100 disabled:opacity-50"
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-newsreader-bold text-white">Send announcement</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
