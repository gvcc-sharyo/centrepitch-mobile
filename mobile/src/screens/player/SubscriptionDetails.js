import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import courtSubscriptionService from "../../services/courtSubscriptionService";
import { formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function SubscriptionDetails() {
  const route = useRoute();
  const subscriptionId = route.params?.subscriptionId;
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);

  const load = useCallback(async () => {
    if (!subscriptionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await courtSubscriptionService.getSubscriptionById(subscriptionId);
      setSub(res.data?.data ?? res.data);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load subscription");
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!subscriptionId) {
    return (
      <PlayerScreenShell title="Subscription">
        <Text className="font-playfair text-neutral-600 dark:text-white/60">Missing subscription.</Text>
      </PlayerScreenShell>
    );
  }

  if (loading) {
    return (
      <PlayerScreenShell title="Subscription" scrollable={false}>
        <View className="flex-1 items-center py-16">
          <ActivityIndicator size="large" color="#0A763A" />
        </View>
      </PlayerScreenShell>
    );
  }

  if (!sub) {
    return (
      <PlayerScreenShell title="Subscription">
        <Text className="font-playfair text-neutral-600 dark:text-white/60">Not found.</Text>
      </PlayerScreenShell>
    );
  }

  const amount =
    sub.paymentDetails?.amount ??
    sub.plan?.tax?.totalAmount ??
    sub.plan?.pricing?.basePrice ??
    0;

  return (
    <PlayerScreenShell title="Subscription">
      <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">
        {sub.plan?.name || "Subscription"}
      </Text>
      <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">
        Status: {sub.status}
      </Text>
      {sub.court?.name ? (
        <Text className="mt-2 font-playfair text-sm text-neutral-800 dark:text-white/85">Court: {sub.court.name}</Text>
      ) : null}
      {sub.academy?.name ? (
        <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/65">{sub.academy.name}</Text>
      ) : null}
      <Text className="mt-4 font-playfair text-lg text-primary">₹{Number(amount).toFixed(0)}</Text>
      {sub.startDate ? (
        <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
          Start: {formatDate(sub.startDate)}
        </Text>
      ) : null}
      {sub.endDate ? (
        <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
          End: {formatDate(sub.endDate)}
        </Text>
      ) : null}
    </PlayerScreenShell>
  );
}
