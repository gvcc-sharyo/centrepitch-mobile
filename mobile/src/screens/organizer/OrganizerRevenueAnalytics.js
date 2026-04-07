import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { formatCurrency, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerRevenueAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizerService.getRevenueAnalytics({ groupBy: "month" });
      const payload = res?.data ?? res;
      setData(payload);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const byEvent = Array.isArray(data?.byEvent) ? data.byEvent : [];
  const trend = Array.isArray(data?.trend) ? data.trend : [];

  return (
    <OrganizerScreenShell title="Revenue analytics" scrollable={false}>
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <ScrollView className="w-full max-w-[720px] self-center" showsVerticalScrollIndicator={false}>
          <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Totals</Text>
            <Text className="mt-2 font-playfair text-sm text-neutral-700 dark:text-white/80">
              Revenue: {formatCurrency(totals.totalRevenue ?? 0, "INR")}
            </Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-700 dark:text-white/80">
              Platform fees: {formatCurrency(totals.platformFees ?? 0, "INR")}
            </Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-700 dark:text-white/80">
              Transactions: {totals.totalTransactions ?? 0}
            </Text>
          </View>
          <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">By event</Text>
          {byEvent.length === 0 ? (
            <Text className="font-playfair text-neutral-600 dark:text-white/60">No payment data yet.</Text>
          ) : (
            byEvent.map((row) => (
              <View
                key={String(row._id)}
                className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{row.eventName}</Text>
                {row.sportName ? (
                  <Text className="mt-1 font-playfair text-xs text-primary">{row.sportName}</Text>
                ) : null}
                <Text className="mt-2 font-playfair text-sm text-neutral-800 dark:text-white/85">
                  {formatCurrency(row.revenue ?? 0, "INR")} · {row.transactions ?? 0} tx
                </Text>
              </View>
            ))
          )}
          <Text className="mb-2 mt-6 font-newsreader-bold text-neutral-900 dark:text-white">Trend</Text>
          {trend.length === 0 ? (
            <Text className="font-playfair text-neutral-600 dark:text-white/60">No trend data.</Text>
          ) : (
            trend.slice(-12).map((t) => (
              <View
                key={String(t.period)}
                className="mb-2 flex-row items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/10"
              >
                <Text className="font-playfair text-sm text-neutral-700 dark:text-white/80">{t.period}</Text>
                <Text className="font-playfair text-sm text-neutral-900 dark:text-white">
                  {formatCurrency(t.revenue ?? 0, "INR")}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
