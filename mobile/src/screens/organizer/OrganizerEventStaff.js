import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import staffService from "../../services/staffService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerEventStaff() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [event, setEvent] = useState(null);
  const [available, setAvailable] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Staff");
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [evRes, avRes] = await Promise.all([
        eventService.getEventById(String(eventId)),
        staffService.getAvailableStaff(String(eventId)),
      ]);
      const ev = evRes?.data ?? evRes;
      setEvent(ev);
      const av = avRes?.data ?? avRes;
      setAvailable(Array.isArray(av) ? av : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load");
      setEvent(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    load();
  }, [eventId, load]);

  const staffRows = Array.isArray(event?.staff) ? event.staff : [];

  const assign = async (staffId) => {
    setAssigning(staffId);
    try {
      await staffService.assignToEvent(staffId, String(eventId), undefined);
      toast.success("Staff assigned");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not assign");
    } finally {
      setAssigning(null);
    }
  };

  const addManual = async () => {
    if (!eventId || !name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await eventService.addStaffToEvent(String(eventId), {
        user: null,
        role: role.trim() || "Staff",
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      toast.success("Staff added");
      setManualOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrganizerScreenShell title="Event staff" scrollable={false}>
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading && !event ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={available}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View>
              <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">On this event</Text>
              {staffRows.length === 0 ? (
                <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/60">No staff yet.</Text>
              ) : (
                staffRows.map((s, i) => (
                  <View
                    key={String(s.email || i)}
                    className="mb-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
                  >
                    <Text className="font-playfair text-sm text-neutral-900 dark:text-white">
                      {s.name || s.role || "Staff"}
                    </Text>
                    {s.email ? (
                      <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">{s.email}</Text>
                    ) : null}
                    {s.role ? (
                      <Text className="font-playfair text-xs text-primary">{s.role}</Text>
                    ) : null}
                  </View>
                ))
              )}
              <Pressable onPress={() => setManualOpen(true)} className="mb-4 items-center rounded-2xl bg-primary py-3">
                <Text className="font-newsreader-bold text-white">Add staff (name & email)</Text>
              </Pressable>
              <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">Available from your roster</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <View className="mr-3 flex-1">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{item.name}</Text>
                <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">{item.email}</Text>
              </View>
              <Pressable
                onPress={() => assign(String(item._id))}
                disabled={assigning === String(item._id)}
                className="rounded-xl bg-primary px-3 py-2"
              >
                <Text className="font-playfair text-sm text-white">{assigning === String(item._id) ? "…" : "Assign"}</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text className="py-4 text-center font-playfair text-neutral-600 dark:text-white/60">
              No saved staff left to assign, or everyone is already on this event.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <Modal visible={manualOpen} animationType="slide" transparent onRequestClose={() => setManualOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setManualOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Add to event</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-4 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone (optional)"
              keyboardType="phone-pad"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="Role"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <Pressable onPress={addManual} disabled={saving} className="mt-4 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50">
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Save</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
