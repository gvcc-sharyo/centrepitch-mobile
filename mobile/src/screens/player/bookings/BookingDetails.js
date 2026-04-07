import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import PlayerScreenShell from "../../../components/player/PlayerScreenShell";
import bookingService from "../../../services/bookingService";
import { formatDate, getErrorMessage } from "../../../utils/helpers";
import { toast } from "../../../utils/toast";

export default function BookingDetails() {
  const route = useRoute();
  const bookingId = route.params?.bookingId;
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

  const load = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await bookingService.getBookingById(bookingId);
      setBooking(res.data?.data ?? res.data);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load booking");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = () => {
    if (!bookingId) return;
    Alert.alert("Cancel booking", "Cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            await bookingService.cancelBooking(bookingId, { reason: "Cancelled by player" });
            toast.success("Booking cancelled");
            load();
          } catch (e) {
            toast.error(getErrorMessage(e) || "Could not cancel");
          }
        },
      },
    ]);
  };

  if (!bookingId) {
    return (
      <PlayerScreenShell title="Booking">
        <Text className="font-playfair text-neutral-600 dark:text-white/60">Missing booking.</Text>
      </PlayerScreenShell>
    );
  }

  if (loading || !booking) {
    return (
      <PlayerScreenShell title="Booking" scrollable={false}>
        <View className="flex-1 items-center py-16">
          {loading ? <ActivityIndicator size="large" color="#0A763A" /> : (
            <Text className="font-playfair text-neutral-600 dark:text-white/60">Not found.</Text>
          )}
        </View>
      </PlayerScreenShell>
    );
  }

  const canCancel =
    booking.status &&
    !["CANCELLED_BY_USER", "CANCELLED_BY_ACADEMY", "COMPLETED"].includes(String(booking.status).toUpperCase());

  return (
    <PlayerScreenShell title="Booking details">
      <View>
        <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">{booking.court?.name}</Text>
        <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">
          {formatDate(booking.bookingDate)}
        </Text>
        <Text className="mt-2 font-playfair text-sm text-neutral-800 dark:text-white/85">
          Status: {String(booking.status || "").replace(/_/g, " ")}
        </Text>
        {booking.pricing?.totalAmount != null ? (
          <Text className="mt-2 font-playfair text-sm text-primary">
            Amount: ₹{Number(booking.pricing.totalAmount).toFixed(0)}
          </Text>
        ) : null}
        {canCancel ? (
          <Pressable onPress={cancel} className="mt-6 items-center rounded-xl bg-red-600 py-3">
            <Text className="font-playfair font-semibold text-white">Cancel booking</Text>
          </Pressable>
        ) : null}
      </View>
    </PlayerScreenShell>
  );
}
