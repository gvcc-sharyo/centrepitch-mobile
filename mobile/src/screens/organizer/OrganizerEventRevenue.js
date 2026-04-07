import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { formatCurrency, formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerEventRevenue() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await organizerService.getEventRevenue(String(eventId));
      const data = res?.data ?? res;
      setPayload(data);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load revenue");
      setPayload(null);
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

  const payments = Array.isArray(payload?.payments) ? payload.payments : [];

  return (
    <OrganizerScreenShell title="Event revenue" scrollable={false}>
      {!eventId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      ) : loading && !payload ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">
                {payload?.eventName || "Event"}
              </Text>
              <Text className="mt-2 font-playfair text-sm text-neutral-700 dark:text-white/80">
                Gross: {formatCurrency(payload?.totalRevenue ?? 0, "INR")} · Platform fees:{" "}
                {formatCurrency(payload?.platformFees ?? 0, "INR")}
              </Text>
              <Text className="mt-1 font-playfair text-sm font-semibold text-neutral-900 dark:text-white">
                Net: {formatCurrency(payload?.netRevenue ?? 0, "INR")} ({payload?.totalPayments ?? 0} payments)
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text className="py-8 text-center font-playfair text-neutral-600 dark:text-white/60">
              No completed payments for this event yet.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">
                {formatCurrency(item.amount, "INR")}
              </Text>
              {item.user ? (
                <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
                  {[item.user.firstName, item.user.lastName].filter(Boolean).join(" ") || item.user.email}
                </Text>
              ) : null}
              {item.paidAt ? (
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/50">
                  {formatDate(item.paidAt, "MMM dd, yyyy HH:mm")}
                </Text>
              ) : null}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </OrganizerScreenShell>
  );
}
