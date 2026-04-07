import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import notificationService from "../../services/notificationService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function collectRecipientUserIds(players, teams) {
  const ids = new Set();
  for (const row of players || []) {
    const p = row?.player;
    const id = typeof p === "object" && p?._id ? p._id : p;
    if (id) ids.add(String(id));
  }
  for (const row of teams || []) {
    const t = row?.team;
    const cap = t?.captain;
    const cid = typeof cap === "object" && cap?._id ? cap._id : cap;
    if (cid) ids.add(String(cid));
  }
  return [...ids];
}

export default function OrganizerBulkNotifications() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendToAll, setSendToAll] = useState(true);
  const [selected, setSelected] = useState({});
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await organizerService.getEventParticipants(String(eventId));
      const payload = res?.data ?? res;
      setPlayers(Array.isArray(payload?.players) ? payload.players : []);
      setTeams(Array.isArray(payload?.teams) ? payload.teams : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load participants");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    load();
  }, [eventId, load]);

  const allIds = useMemo(() => collectRecipientUserIds(players, teams), [players, teams]);

  const choiceRows = useMemo(() => {
    const rows = [];
    for (const row of players) {
      const p = row?.player;
      const id = typeof p === "object" && p?._id ? String(p._id) : p ? String(p) : "";
      if (!id) continue;
      const name = typeof p === "object" ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email : id;
      rows.push({ id, label: `Player: ${name}` });
    }
    for (const row of teams) {
      const t = row?.team;
      const cap = t?.captain;
      const cid = typeof cap === "object" && cap?._id ? String(cap._id) : cap ? String(cap) : "";
      if (!cid) continue;
      const tname = typeof t === "object" ? t.name : "Team";
      rows.push({ id: cid, label: `Team captain (${tname})` });
    }
    return rows;
  }, [players, teams]);

  const toggle = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const send = async () => {
    if (!eventId || !title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    let recipients = allIds;
    if (!sendToAll) {
      recipients = Object.keys(selected).filter((k) => selected[k]);
      if (recipients.length === 0) {
        toast.error("Select at least one recipient");
        return;
      }
    }
    setSending(true);
    try {
      await notificationService.sendBulkNotifications({
        recipients,
        type: "announcement",
        title: title.trim(),
        message: message.trim(),
        priority: "medium",
        data: { eventId: String(eventId) },
      });
      toast.success(`Sent to ${recipients.length} recipient(s)`);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <OrganizerScreenShell title="Bulk notify">
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading ? (
        <View className="items-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <ScrollView className="w-full max-w-[720px] self-center" keyboardShouldPersistTaps="handled">
          <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/65">
            Sends individual notifications to selected user accounts (player IDs / team captains). For email to
            non-users, use Announcement instead.
          </Text>
          <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <Text className="flex-1 font-playfair text-sm text-neutral-800 dark:text-white/85">Everyone on this list</Text>
            <Switch value={sendToAll} onValueChange={setSendToAll} />
          </View>
          {!sendToAll ? (
            <View className="mb-4">
              {choiceRows.map((r, idx) => (
                <Pressable
                  key={`${r.id}-${idx}`}
                  onPress={() => toggle(r.id)}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/10"
                >
                  <Text className="flex-1 font-playfair text-sm text-neutral-800 dark:text-white/85">{r.label}</Text>
                  <Text className="font-playfair text-sm text-primary">{selected[r.id] ? "On" : "Off"}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text className="font-playfair text-xs uppercase text-neutral-500 dark:text-white/50">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="rgba(107,114,128,0.9)"
            className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <Text className="mt-4 font-playfair text-xs uppercase text-neutral-500 dark:text-white/50">Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            multiline
            textAlignVertical="top"
            placeholderTextColor="rgba(107,114,128,0.9)"
            className="mt-1 min-h-[100px] rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <Pressable
            onPress={send}
            disabled={sending}
            className="mt-6 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-newsreader-bold text-white">Send bulk notifications</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
