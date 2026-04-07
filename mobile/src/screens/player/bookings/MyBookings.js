import React, { useCallback, useEffect, useState } from "react";
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

import PlayerScreenShell from "../../../components/player/PlayerScreenShell";
import { SCREENS } from "../../../constants/navigation";
import bookingService from "../../../services/bookingService";
import { formatDate, getErrorMessage } from "../../../utils/helpers";
import { toast } from "../../../utils/toast";

function slotsLabel(booking) {
  if (booking.timeSlots?.length) {
    const active = booking.timeSlots.filter((s) => s.status !== "CANCELLED");
    return active.map((s) => `${s.startTime}–${s.endTime}`).join(", ");
  }
  if (booking.timeSlot?.startTime && booking.timeSlot?.endTime) {
    return `${booking.timeSlot.startTime}–${booking.timeSlot.endTime}`;
  }
  return "—";
}

function locationLabel(booking) {
  const academyName = booking?.academy?.name || booking?.court?.academy?.name || "";
  const city = booking?.academy?.address?.city || booking?.court?.academy?.address?.city || "";
  const state = booking?.academy?.address?.state || booking?.court?.academy?.address?.state || "";
  const area = [city, state].filter(Boolean).join(", ");
  if (academyName && area) return `${academyName} (${area})`;
  return academyName || area || "Location TBC";
}

export default function MyBookings() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchBookings = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const params =
        filter === "upcoming" ? { upcoming: "true" } : filter !== "all" ? { status: filter } : {};
      const res = await bookingService.getMyBookings(params);
      const list = res.data?.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load bookings");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBookings(false);
  }, [fetchBookings]);

  const filters = [
    { value: "all", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED_BY_USER", label: "Cancelled" },
  ];

  const filterLabel = filters.find((f) => f.value === filter)?.label ?? "All";

  return (
    <PlayerScreenShell title="My bookings" scrollable={false}>
      <Text className="mb-1 font-playfair text-xs font-semibold text-neutral-600 dark:text-white/65">Filter</Text>
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
            <Text className="mb-3 font-newsreader-bold text-base text-neutral-900 dark:text-white">Bookings</Text>
            {filters.map((f) => {
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

      {loading && rows.length === 0 ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchBookings(true)} />}
          ListEmptyComponent={
            <Text className="py-10 text-center font-playfair text-neutral-600 dark:text-white/60">No bookings.</Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate(SCREENS.BookingDetails, { bookingId: String(item._id) })}
              className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Text className="font-newsreader-bold text-base text-neutral-900 dark:text-white">
                {item.court?.name || "Court"}
              </Text>
              <Text className="mt-1 font-playfair text-xs text-neutral-600 dark:text-white/65">{locationLabel(item)}</Text>
              <Text className="mt-2 font-playfair text-xs text-neutral-700 dark:text-white/75">
                {formatDate(item.bookingDate)} · {slotsLabel(item)}
              </Text>
              <Text className="mt-2 font-playfair text-xs capitalize text-primary">
                {String(item.status || "").replace(/_/g, " ").toLowerCase()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </PlayerScreenShell>
  );
}
