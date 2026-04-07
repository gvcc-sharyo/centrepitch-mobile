import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import { SCREENS } from "../../constants/navigation";
import courtSubscriptionService from "../../services/courtSubscriptionService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function statusClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200";
  if (s === "EXPIRED") return "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/75";
  if (s === "CANCELLED") return "bg-red-100 text-red-800 dark:bg-red-900/35 dark:text-red-200";
  if (s === "PENDING_PAYMENT") return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100";
  return "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-white/75";
}

export default function MySubscriptions() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const load = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await courtSubscriptionService.getMySubscriptions();
      const body = res.data;
      const rows = body?.data ?? body?.subscriptions ?? [];
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load subscriptions");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((s) => String(s.status).toUpperCase() === filter.toUpperCase()),
    [items, filter]
  );

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "EXPIRED", label: "Expired" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "PENDING_PAYMENT", label: "Pending payment" },
  ];

  const filterLabel = filterOptions.find((f) => f.value === filter)?.label ?? "All";

  return (
    <PlayerScreenShell title="Subscriptions" scrollable={false}>
      <Text className="mb-1 font-playfair text-xs font-semibold text-neutral-600 dark:text-white/65">Status</Text>
      <Pressable
        onPress={() => setFilterMenuOpen(true)}
        className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5"
      >
        <Text className="font-playfair text-sm text-neutral-900 dark:text-white">{filterLabel}</Text>
        <Feather name="chevron-down" size={20} color="rgba(107,114,128,0.9)" />
      </Pressable>

      <Modal
        visible={filterMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuOpen(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setFilterMenuOpen(false)} />
          <View className="rounded-t-3xl border border-neutral-200 bg-white px-4 pb-8 pt-2 dark:border-white/15 dark:bg-[#1a2545]">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300 dark:bg-white/25" />
            <Text className="mb-3 font-newsreader-bold text-base text-neutral-900 dark:text-white">Status</Text>
            {filterOptions.map((f) => {
              const selected = filter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => {
                    setFilter(f.value);
                    setFilterMenuOpen(false);
                  }}
                  className={`flex-row items-center justify-between border-b border-neutral-100 py-3 dark:border-white/10 ${selected ? "-mx-2 rounded-xl border-0 bg-primary/10 px-2" : ""}`}
                >
                  <Text
                    className={`font-playfair text-base ${selected ? "font-semibold text-primary" : "text-neutral-900 dark:text-white"}`}
                  >
                    {f.label}
                  </Text>
                  {selected ? <Feather name="check" size={20} color="#0A763A" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {loading && items.length === 0 ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">No subscriptions.</Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-newsreader-bold text-base text-neutral-900 dark:text-white">
                  {item.plan?.name || "Plan"}
                </Text>
                <Text className={`rounded-full px-2 py-0.5 font-playfair text-[10px] font-semibold ${statusClass(item.status)}`}>
                  {item.status}
                </Text>
              </View>
              {item.court?.name ? (
                <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">{item.court.name}</Text>
              ) : null}
              {item.academy?.name ? (
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">{item.academy.name}</Text>
              ) : null}
              <Pressable
                onPress={() => navigation.navigate(SCREENS.SubscriptionDetails, { subscriptionId: String(item._id) })}
                className="mt-3 self-start rounded-lg border border-primary/40 px-3 py-1.5"
              >
                <Text className="font-playfair text-xs font-semibold text-primary">Details</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </PlayerScreenShell>
  );
}
