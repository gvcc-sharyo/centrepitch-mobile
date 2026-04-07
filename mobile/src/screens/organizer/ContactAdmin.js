import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function ContactAdmin() {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      await organizerService.contactSuperAdmin({ subject: subject.trim(), message: message.trim() });
      toast.success("Message sent");
      setSubject("");
      setMessage("");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <OrganizerScreenShell title="Contact admin">
      <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/65">
        Reach the platform admin with questions about your organizer account or billing.
      </Text>
      <LabeledIconInput icon="edit-2" label="Subject" value={subject} onChangeText={setSubject} />
      <Text className="mb-1 mt-3 font-playfair text-sm text-neutral-600 dark:text-white/60">Message</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="How can we help?"
        placeholderTextColor={ph}
        multiline
        className={`min-h-[140px] ${inputClass}`}
        textAlignVertical="top"
      />
      <Pressable
        onPress={send}
        disabled={sending}
        className="mt-6 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
      >
        <Text className="font-newsreader-bold text-white">{sending ? "Sending…" : "Send message"}</Text>
      </Pressable>
    </OrganizerScreenShell>
  );
}
