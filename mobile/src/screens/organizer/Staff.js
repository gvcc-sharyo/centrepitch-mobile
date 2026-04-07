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
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import staffService from "../../services/staffService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function Staff() {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Event staff");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await staffService.getStaffMembers({ page: 1, limit: 100 });
      const rows = res?.data ?? res?.staff ?? [];
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load staff");
      setStaff([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const createStaff = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await staffService.createStaff({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role: role.trim() || "Event staff",
      });
      toast.success("Staff member created");
      setModalOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setRole("Event staff");
      load(false);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not create");
    } finally {
      setSaving(false);
    }
  };

  const numColumns = width >= 700 ? 2 : 1;

  const renderItem = ({ item }) => (
    <View
      className={`mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 ${
        numColumns === 2 ? "mx-1.5 flex-1" : ""
      }`}
    >
      <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white">{item.name || "Staff"}</Text>
      {item.role ? (
        <Text className="mt-1 font-playfair text-xs text-primary">{item.role}</Text>
      ) : null}
      {item.email ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Feather name="mail" size={14} color={isDark ? "#9ca3af" : "#6b7280"} />
          <Text className="flex-1 font-playfair text-xs text-neutral-600 dark:text-white/65" numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      ) : null}
      {item.phone ? (
        <View className="mt-1 flex-row items-center gap-2">
          <Feather name="phone" size={14} color={isDark ? "#9ca3af" : "#6b7280"} />
          <Text className="font-playfair text-xs text-neutral-600 dark:text-white/65">{item.phone}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <OrganizerScreenShell title="Staff" scrollable={false} showBack={false}>
      <View className="w-full max-w-[720px] flex-1 self-center">
        <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
            Create staff here, assign them to events from each event&apos;s Event staff screen, or use the web dashboard
            for advanced edits.
          </Text>
          <Pressable onPress={() => setModalOpen(true)} className="mt-3 items-center rounded-2xl bg-primary py-3">
            <Text className="font-newsreader-bold text-white">Add staff member</Text>
          </Pressable>
        </View>
        {loading && staff.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color="#1F2B55" />
          </View>
        ) : (
          <FlatList
            data={staff}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => String(item._id || item.id)}
            columnWrapperStyle={numColumns === 2 ? { paddingHorizontal: 4 } : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
                No staff members yet.
              </Text>
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setModalOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">New staff</Text>
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
            <Pressable
              onPress={createStaff}
              disabled={saving}
              className="mt-4 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-newsreader-bold text-white">Save</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
