import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import PlayerScreenShell from "../../components/player/PlayerScreenShell";
import courtSubscriptionService from "../../services/courtSubscriptionService";
import subscriptionService from "../../services/subscriptionService";
import { formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function SubscriptionDetails() {
  const route = useRoute();
  const subscriptionId = route.params?.subscriptionId;
  const subscriptionKind = route.params?.subscriptionKind;
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);

  const load = useCallback(async () => {
    if (!subscriptionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const loadRoleById = async () => {
        const res = await subscriptionService.getMySubscriptionHistory();
        const list = res.data?.data ?? [];
        const found = Array.isArray(list)
          ? list.find((x) => String(x._id) === String(subscriptionId))
          : null;
        return found ? { ...found, kind: "role" } : null;
      };

      if (subscriptionKind === "role") {
        const row = await loadRoleById();
        setSub(row);
        if (!row) toast.error("Subscription not found");
        return;
      }
      if (subscriptionKind === "court") {
        const res = await courtSubscriptionService.getSubscriptionById(subscriptionId);
        setSub({ ...(res.data?.data ?? res.data), kind: "court" });
        return;
      }

      try {
        const res = await courtSubscriptionService.getSubscriptionById(subscriptionId);
        setSub({ ...(res.data?.data ?? res.data), kind: "court" });
      } catch {
        const row = await loadRoleById();
        setSub(row);
        if (!row) toast.error("Subscription not found");
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load subscription");
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, subscriptionKind]);

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

  if (sub.kind === "role") {
    const amount = sub.amount ?? 0;
    const cur = sub.currency || "INR";
    const sym = cur === "INR" ? "₹" : `${cur} `;
    return (
      <PlayerScreenShell title="Subscription">
        <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">
          {sub.plan?.name || "Subscription"}
        </Text>
        <Text className="mt-1 font-playfair text-[10px] uppercase tracking-wide text-neutral-400 dark:text-white/45">
          Plan subscription
        </Text>
        <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">
          Status: {sub.status}
        </Text>
        {sub.roleRef?.displayName || sub.role ? (
          <Text className="mt-2 font-playfair text-sm text-neutral-800 dark:text-white/85">
            Role: {sub.roleRef?.displayName || sub.role}
          </Text>
        ) : null}
        {sub.billingCycle ? (
          <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
            Billing: {sub.billingCycle}
          </Text>
        ) : null}
        <Text className="mt-4 font-playfair text-lg text-primary">
          {sym}
          {Number(amount).toFixed(0)}
        </Text>
        {sub.startsAt ? (
          <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/55">
            Start: {formatDate(sub.startsAt)}
          </Text>
        ) : null}
        {sub.expiresAt ? (
          <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/55">
            Expires: {formatDate(sub.expiresAt)}
          </Text>
        ) : null}
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
      <Text className="mt-1 font-playfair text-[10px] uppercase tracking-wide text-neutral-400 dark:text-white/45">
        Court subscription
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
