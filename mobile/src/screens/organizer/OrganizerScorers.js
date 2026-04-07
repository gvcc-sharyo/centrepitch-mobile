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

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerScorers() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await organizerService.getScorers({ page: 1, limit: 100 });
      const list = res?.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load scorers");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const createScorer = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);
    try {
      await organizerService.createScorer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
      toast.success("Scorer created — they will receive an OTP email");
      setModalOpen(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      load(false);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not create scorer");
    } finally {
      setCreating(false);
    }
  };

  return (
    <OrganizerScreenShell title="Scorers" scrollable={false}>
      <View className="w-full max-w-[720px] flex-1 self-center">
        <Pressable onPress={() => setModalOpen(true)} className="mb-4 items-center rounded-2xl bg-primary py-3.5">
          <Text className="font-newsreader-bold text-white">Create scorer account</Text>
        </Pressable>
        {loading && rows.length === 0 ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator color="#1F2B55" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item._id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">
                No scorers yet. Create one to assign to events.
              </Text>
            }
            renderItem={({ item }) => (
              <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">
                  {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Scorer"}
                </Text>
                {item.email ? (
                  <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/65">{item.email}</Text>
                ) : null}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[90%] rounded-t-3xl bg-white p-5 dark:bg-[#1F2B55]"
          >
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">New scorer</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-4 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Temporary password"
              secureTextEntry
              placeholderTextColor="rgba(107,114,128,0.9)"
              className="mt-2 rounded-2xl border border-neutral-200 px-4 py-3 font-playfair dark:border-white/10 dark:text-white"
            />
            <Pressable
              onPress={createScorer}
              disabled={creating}
              className="mt-4 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-newsreader-bold text-white">Create</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </OrganizerScreenShell>
  );
}
