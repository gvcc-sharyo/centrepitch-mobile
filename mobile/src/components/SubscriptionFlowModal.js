import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import subscriptionService from "../services/subscriptionService";
import { getMe, selectUser } from "../store/slices/authSlice";
import { toast } from "../utils/toast";
import { getErrorMessage } from "../utils/helpers";

const BILLING_CYCLES = [
  { key: "monthly", label: "Monthly", unit: "mo" },
  { key: "quarterly", label: "Quarterly", unit: "qtr" },
  { key: "halfYearly", label: "Half-Yearly", unit: "6mo" },
  { key: "yearly", label: "Yearly", unit: "yr" },
];

const ALLOWED_PLAN_SLUGS = ["basic", "premium", "enterprise"];

const FALLBACK_PLANS = [
  {
    slug: "basic",
    name: "Basic",
    price: { monthly: 999, quarterly: 2799, halfYearly: 5299, yearly: 9999 },
    features: ["Core features", "Team management"],
  },
  {
    slug: "premium",
    name: "Premium",
    price: { monthly: 2499, quarterly: 6999, halfYearly: 13299, yearly: 24999 },
    features: ["Advanced analytics", "Priority support"],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: { monthly: 4999, quarterly: 13999, halfYearly: 26999, yearly: 49999 },
    features: ["Dedicated support", "Advanced setup"],
  },
];

const PLAN_NAME_BY_SLUG = {
  basic: "Basic",
  premium: "Premium",
  enterprise: "Enterprise",
};

const UPGRADE_ROLE_ORDER = ["coach", "academyadmin", "organizer"];
const UPGRADE_ROLE_LABELS = {
  coach: "Coach",
  academyadmin: "Academy Admin",
  organizer: "Organizer",
};

function getCyclePrice(plan, cycle) {
  const monthly = Number(plan?.price?.monthly || 0);
  const yearly = Number(plan?.price?.yearly || 0);
  if (cycle === "quarterly") {
    const quarterly = Number(plan?.price?.quarterly || 0);
    return quarterly > 0 ? quarterly : monthly * 3;
  }
  if (cycle === "halfYearly") {
    const halfYearly = Number(plan?.price?.halfYearly || 0);
    if (halfYearly > 0) return halfYearly;
    if (monthly > 0) return monthly * 6;
    return yearly > 0 ? Math.round(yearly / 2) : 0;
  }
  if (cycle === "yearly") return yearly;
  return monthly;
}

function getFeaturesForCycle(plan, cycle) {
  const byCycle = plan?.featuresByCycle?.[cycle];
  if (Array.isArray(byCycle) && byCycle.length > 0) return byCycle;
  return Array.isArray(plan?.features) ? plan.features : [];
}

function normalizeFeatureRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((feature) => {
      if (typeof feature === "string") {
        return { text: feature, included: true, highlight: false };
      }
      return {
        text: String(feature?.text || "").trim(),
        included: feature?.included !== false,
        highlight: Boolean(feature?.highlight),
      };
    })
    .filter((feature) => feature.text);
}

function getPlanDisplayName(plan) {
  const slug = String(plan?.slug || "").toLowerCase();
  return PLAN_NAME_BY_SLUG[slug] || plan?.name || "Plan";
}

/** Same as `frontend/src/components/common/SubscriptionModal.jsx` — dummy gateway fields. */
const PAYMENT_METHODS = [
  { key: "CARD", label: "Card", icon: "credit-card", backend: "card" },
  { key: "UPI", label: "UPI", icon: "smartphone", backend: "upi" },
  { key: "NET_BANKING", label: "Net Banking", icon: "shield", backend: "netbanking" },
];

const DEMO_BANKS = ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "PNB"];

function formatCardNumber(value = "") {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value = "") {
  const v = value.replace(/\D/g, "").slice(0, 4);
  if (v.length <= 2) return v;
  return `${v.slice(0, 2)}/${v.slice(2)}`;
}

/**
 * Subscription / unlock flow — aligned with `frontend/src/components/common/SubscriptionModal.jsx`.
 * @param {'unlock'|'upgrade'} variant — unlock: player adds a paid role; upgrade: current role plan renewal.
 */
export default function SubscriptionFlowModal({ visible, onClose, variant }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const [plans, setPlans] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedTargetRoleId, setSelectedTargetRoleId] = useState("");
  const [selectedTargetRoleName, setSelectedTargetRoleName] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [paymentStep, setPaymentStep] = useState("form");
  const [paymentError, setPaymentError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [upiId, setUpiId] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [lastTransactionId, setLastTransactionId] = useState("");
  const [lastPaidAmount, setLastPaidAmount] = useState(0);
  const [lastPaidCycle, setLastPaidCycle] = useState("");

  const userRole = String(user?.role || "").toLowerCase();
  const isUnlock = variant === "unlock";

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await subscriptionService.getRoles();
        const fetchedRoles = Array.isArray(response?.data?.data) ? response.data.data : [];
        const normalizedRoles = fetchedRoles
          .map((role) => ({
            _id: role?._id,
            name: String(role?.name || "").toLowerCase(),
            displayName:
              role?.displayName ||
              UPGRADE_ROLE_LABELS[String(role?.name || "").toLowerCase()] ||
              role?.name ||
              "Role",
          }))
          .filter((role) => UPGRADE_ROLE_ORDER.includes(role.name))
          .sort((a, b) => UPGRADE_ROLE_ORDER.indexOf(a.name) - UPGRADE_ROLE_ORDER.indexOf(b.name));
        if (!cancelled) {
          setRoleOptions(
            normalizedRoles.length
              ? normalizedRoles
              : UPGRADE_ROLE_ORDER.map((name) => ({
                  _id: "",
                  name,
                  displayName: UPGRADE_ROLE_LABELS[name],
                }))
          );
        }
      } catch {
        if (!cancelled) {
          setRoleOptions(
            UPGRADE_ROLE_ORDER.map((name) => ({
              _id: "",
              name,
              displayName: UPGRADE_ROLE_LABELS[name],
            }))
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const unlockedRoleNames = new Set(
      (Array.isArray(user?.unlockedRoles) ? user.unlockedRoles : [])
        .map((entry) => String(entry?.role || "").toLowerCase())
        .filter(Boolean)
    );
    const fallbackRoleName =
      userRole === "player"
        ? UPGRADE_ROLE_ORDER.find((name) => !unlockedRoleNames.has(name)) || "coach"
        : userRole;
    const resolvedRoleName = userRole === "player" ? selectedTargetRoleName || fallbackRoleName : userRole;
    const resolvedRole =
      roleOptions.find((item) => item.name === resolvedRoleName) ||
      roleOptions.find((item) => item.name === fallbackRoleName) ||
      null;
    if (userRole !== "player") {
      if (selectedTargetRoleName !== userRole) setSelectedTargetRoleName(userRole);
      if (selectedTargetRoleId !== (resolvedRole?._id || "")) setSelectedTargetRoleId(resolvedRole?._id || "");
      return;
    }
    if (!selectedTargetRoleName || !resolvedRole) {
      setSelectedTargetRoleName(resolvedRole?.name || fallbackRoleName);
      setSelectedTargetRoleId(resolvedRole?._id || "");
    } else if (selectedTargetRoleId !== (resolvedRole?._id || "")) {
      setSelectedTargetRoleId(resolvedRole?._id || "");
    }
  }, [visible, userRole, user?.unlockedRoles, roleOptions, selectedTargetRoleName, selectedTargetRoleId]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      try {
        const params = {};
        if (selectedTargetRoleId) params.roleId = selectedTargetRoleId;
        else if (selectedTargetRoleName) params.role = selectedTargetRoleName;
        else params.role = userRole;
        const response = await subscriptionService.getPlans(params);
        const fetched = response?.data?.data || [];
        const normalized = (Array.isArray(fetched) ? fetched : []).filter((plan) =>
          ALLOWED_PLAN_SLUGS.includes(String(plan?.slug || "").toLowerCase())
        );
        if (!cancelled) setPlans(normalized.length ? normalized : FALLBACK_PLANS);
      } catch {
        if (!cancelled) setPlans(FALLBACK_PLANS);
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedTargetRoleId, selectedTargetRoleName, userRole]);

  useEffect(() => {
    if (!visible) return;
    setSelectedPlan("");
  }, [visible, selectedTargetRoleId, selectedTargetRoleName]);

  useEffect(() => {
    if (!visible) return;
    setPaymentStep("form");
    setPaymentError("");
    setPaymentMethod("CARD");
    setCardForm({ number: "", expiry: "", cvv: "", name: "" });
    setUpiId("");
    setSelectedBank("");
    setLastTransactionId("");
    setLastPaidAmount(0);
    setLastPaidCycle("");
  }, [visible, variant]);

  const handleActivate = useCallback(async () => {
    if (!selectedPlan) {
      toast.error("Please select a subscription plan");
      return;
    }
    const role = userRole;
    const targetRoleName = String(selectedTargetRoleName || role).toLowerCase();
    const organizerPaymentFlow = targetRoleName === "organizer";
    const requiresAcademyName = targetRoleName === "academyadmin" && !user?.academyId;
    const normalizedAcademyName = String(academyName || "")
      .trim()
      .replace(/\s+/g, " ");

    if (requiresAcademyName && !normalizedAcademyName) {
      toast.error("Academy name is required to unlock Academy Admin role");
      return;
    }

    if (organizerPaymentFlow && paymentMethod === "CARD") {
      if (cardForm.number.replace(/\s/g, "").length < 16) {
        toast.error("Enter a valid card number");
        return;
      }
      if (cardForm.expiry.length < 5) {
        toast.error("Enter a valid expiry (MM/YY)");
        return;
      }
      if (cardForm.cvv.length < 3) {
        toast.error("Enter a valid CVV");
        return;
      }
      if (!cardForm.name.trim()) {
        toast.error("Enter cardholder name");
        return;
      }
    }
    if (organizerPaymentFlow && paymentMethod === "UPI" && !upiId.includes("@")) {
      toast.error("Enter a valid UPI ID (e.g. name@upi)");
      return;
    }
    if (organizerPaymentFlow && paymentMethod === "NET_BANKING" && !selectedBank) {
      toast.error("Please select a bank");
      return;
    }

    const selectedMethod = PAYMENT_METHODS.find((m) => m.key === paymentMethod);
    const backendPaymentMethod = selectedMethod?.backend || "card";

    try {
      setIsActivating(true);
      setPaymentStep("processing");
      setPaymentError("");
      setLastTransactionId("");
      setLastPaidAmount(0);
      setLastPaidCycle("");

      const planRow = plans.find((p) => p.slug === selectedPlan);
      let paidAmount = getCyclePrice(planRow, billingCycle) || 0;
      let confirmedTxnId = "";
      let resolvedActiveRole = String(targetRoleName || role).toLowerCase();

      const runOrganizerPaymentFlow = async () => {
        const intentRes = await subscriptionService.createPaymentIntent({
          planSlug: selectedPlan,
          billingCycle,
          paymentMethod: backendPaymentMethod,
          targetRoleRef: selectedTargetRoleId || undefined,
          targetRole: targetRoleName,
          academyName: normalizedAcademyName || undefined,
        });
        const paymentId = intentRes?.data?.data?.paymentId;
        const amount = intentRes?.data?.data?.amount || 0;
        if (!paymentId) throw new Error("Unable to initialize subscription payment");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const dummyTxnId = `SUBTXN${Date.now().toString(36).toUpperCase()}${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;
        const confirmRes = await subscriptionService.confirmPayment(paymentId, {
          paymentMethod: backendPaymentMethod,
          transactionId: dummyTxnId,
          paymentGateway: "DUMMY_GATEWAY",
          paymentResponse: {
            status: "SUCCESS",
            gateway_txn_id: dummyTxnId,
            amount,
            currency: "INR",
            method: backendPaymentMethod,
            bank: selectedBank || undefined,
          },
        });
        confirmedTxnId = confirmRes?.data?.data?.transactionId || dummyTxnId;
        paidAmount = Number(amount || paidAmount);
        resolvedActiveRole = String(confirmRes?.data?.data?.activeRole || resolvedActiveRole).toLowerCase();
      };

      if (organizerPaymentFlow) {
        await runOrganizerPaymentFlow();
      } else {
        try {
          const activateRes = await subscriptionService.activateSubscription({
            planSlug: selectedPlan,
            billingCycle,
            targetRoleRef: selectedTargetRoleId || undefined,
            targetRole: targetRoleName,
            academyName: normalizedAcademyName || undefined,
          });
          resolvedActiveRole = String(activateRes?.data?.data?.activeRole || resolvedActiveRole).toLowerCase();
        } catch (activateError) {
          if (activateError?.response?.data?.code === "PAYMENT_CONFIRMATION_REQUIRED") {
            await runOrganizerPaymentFlow();
          } else {
            throw activateError;
          }
        }
      }

      setLastTransactionId(confirmedTxnId);
      setLastPaidAmount(Number(paidAmount || 0));
      setLastPaidCycle(String(billingCycle || "monthly"));
      setPaymentStep("success");
      await dispatch(getMe()).unwrap();
      toast.success("Subscription activated successfully");
      setTimeout(() => {
        onClose?.();
        setPaymentStep("form");
        setLastTransactionId("");
        setLastPaidAmount(0);
        setLastPaidCycle("");
      }, 1100);
    } catch (error) {
      const errorMessage = error?.response?.data?.message || getErrorMessage(error) || "Failed to activate subscription";
      setPaymentError(errorMessage);
      setPaymentStep("failed");
      toast.error(errorMessage);
    } finally {
      setIsActivating(false);
    }
  }, [
    selectedPlan,
    billingCycle,
    selectedTargetRoleId,
    selectedTargetRoleName,
    userRole,
    user?.academyId,
    academyName,
    dispatch,
    onClose,
    plans,
    paymentMethod,
    cardForm,
    upiId,
    selectedBank,
  ]);

  const title = useMemo(() => {
    if (isUnlock) return "Unlock roles";
    return "Upgrade subscription";
  }, [isUnlock]);

  const subtitle = useMemo(() => {
    if (isUnlock) return "Subscribe to unlock Coach, Academy Admin, or Organizer roles.";
    return "Select a plan and complete activation to continue full access.";
  }, [isUnlock]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" />
        <View className="max-h-[92%] rounded-t-3xl bg-white dark:bg-[#1a2545]">
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-white/10">
            <Text className="flex-1 text-xl font-newsreader-bold text-neutral-900 dark:text-white">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={22} color="#6B7280" />
            </Pressable>
          </View>
          <Text className="px-5 pb-3 text-sm font-playfair text-neutral-600 dark:text-white/70">{subtitle}</Text>

          <ScrollView
            className="px-5 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {paymentStep === "processing" ? (
              <View className="items-center py-16">
                <ActivityIndicator size="large" />
                <Text className="mt-4 text-center font-playfair font-semibold text-neutral-800 dark:text-white/85">
                  Processing dummy payment…
                </Text>
                <Text className="mt-1 px-4 text-center text-sm font-playfair text-neutral-500 dark:text-white/55">
                  Please wait while we confirm your subscription (demo gateway).
                </Text>
              </View>
            ) : paymentStep === "success" ? (
              <View className="items-center py-16">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                  <Feather name="check" size={28} color="#10B981" />
                </View>
                <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white">Payment successful</Text>
                <Text className="mt-1 text-center font-playfair text-neutral-600 dark:text-white/70">
                  Subscription is now active.
                </Text>
                {lastTransactionId ? (
                  <Text className="mt-3 text-center text-xs font-playfair text-neutral-500 dark:text-white/55">
                    Txn: {lastTransactionId}
                  </Text>
                ) : null}
                {lastPaidAmount > 0 ? (
                  <Text className="mt-1 text-center text-xs font-playfair text-neutral-500 dark:text-white/55">
                    Amount paid: ₹{new Intl.NumberFormat("en-IN").format(lastPaidAmount)}
                  </Text>
                ) : null}
                {lastPaidCycle ? (
                  <Text className="mt-1 text-center text-xs font-playfair text-neutral-500 dark:text-white/55">
                    Billing: {BILLING_CYCLES.find((c) => c.key === lastPaidCycle)?.label || lastPaidCycle}
                  </Text>
                ) : null}
              </View>
            ) : paymentStep === "failed" ? (
              <View className="py-10">
                <Text className="text-center font-playfair text-red-600 dark:text-red-400">{paymentError}</Text>
                <Pressable
                  onPress={() => setPaymentStep("form")}
                  className="mt-4 self-center rounded-2xl bg-primary px-6 py-3"
                >
                  <Text className="font-newsreader-bold text-white">Try again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {isUnlock && userRole === "player" ? (
                  <View className="mb-4">
                    <Text className="mb-3 text-sm font-playfair font-semibold text-neutral-800 dark:text-white/90">
                      Select role to unlock
                    </Text>
                    <View className="w-full flex-row gap-2">
                      {roleOptions.map((roleOption) => {
                        const isSelected = selectedTargetRoleName === roleOption.name;
                        return (
                          <Pressable
                            key={`${roleOption._id || roleOption.name}`}
                            onPress={() => {
                              setSelectedTargetRoleName(roleOption.name);
                              setSelectedTargetRoleId(roleOption._id || "");
                              setSelectedPlan("");
                            }}
                            className={[
                              "min-h-[44px] flex-1 basis-0 min-w-0 items-center justify-center rounded-xl border px-1.5 py-1",
                              isSelected
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                                : "border-neutral-200 bg-white dark:border-white/15 dark:bg-white/5",
                            ].join(" ")}
                          >
                            <Text
                              className={[
                                "w-full text-center text-[11px] font-playfair font-semibold",
                                isSelected
                                  ? "text-indigo-800 dark:text-indigo-200"
                                  : "text-neutral-800 dark:text-white/85",
                              ].join(" ")}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.65}
                            >
                              {roleOption.displayName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {selectedTargetRoleName === "academyadmin" && !user?.academyId ? (
                      <View className="mt-3">
                        <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">
                          Academy name *
                        </Text>
                        <TextInput
                          value={academyName}
                          onChangeText={setAcademyName}
                          placeholder="Your academy name"
                          placeholderTextColor="rgba(156,163,175,0.9)"
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View className="mb-4 flex-row flex-wrap gap-2">
                  {BILLING_CYCLES.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => setBillingCycle(c.key)}
                      className={[
                        "rounded-full px-3 py-1.5",
                        billingCycle === c.key ? "bg-primary" : "bg-neutral-100 dark:bg-white/10",
                      ].join(" ")}
                    >
                      <Text
                        className={[
                          "text-xs font-newsreader-bold",
                          billingCycle === c.key ? "text-white" : "text-neutral-700 dark:text-white/80",
                        ].join(" ")}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {loadingPlans ? (
                  <View className="items-center py-8">
                    <ActivityIndicator />
                  </View>
                ) : (
                  <View className="gap-3">
                    {plans.map((plan) => {
                      const price = getCyclePrice(plan, billingCycle);
                      const isSelected = selectedPlan === plan.slug;
                      const cycleMeta = BILLING_CYCLES.find((x) => x.key === billingCycle) || BILLING_CYCLES[0];
                      const features = normalizeFeatureRows(getFeaturesForCycle(plan, billingCycle)).slice(0, 5);
                      return (
                        <Pressable
                          key={plan._id || plan.slug}
                          onPress={() => setSelectedPlan(plan.slug)}
                          className={[
                            "rounded-2xl border p-4",
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-neutral-200 dark:border-white/10",
                          ].join(" ")}
                        >
                          <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white">
                            {getPlanDisplayName(plan)}
                          </Text>
                          <Text className="mt-1 text-2xl font-newsreader-bold text-neutral-900 dark:text-white">
                            ₹{new Intl.NumberFormat("en-IN").format(price || 0)}
                            <Text className="text-sm font-playfair text-neutral-500 dark:text-white/60">
                              {" "}
                              / {cycleMeta.unit}
                            </Text>
                          </Text>
                          {features.map((f, idx) => (
                            <Text key={idx} className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
                              {f.included ? "✓ " : "— "}
                              {f.text}
                            </Text>
                          ))}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {!loadingPlans && selectedPlan ? (
                  <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <View className="flex-row items-start justify-between">
                      <Text className="flex-1 text-sm font-playfair text-neutral-600 dark:text-white/75">
                        {getPlanDisplayName(plans.find((p) => p.slug === selectedPlan) || { slug: selectedPlan })}
                      </Text>
                      <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">
                        {BILLING_CYCLES.find((c) => c.key === billingCycle)?.label || billingCycle}
                      </Text>
                    </View>
                    <View className="mt-2 border-t border-neutral-200 pt-2 dark:border-white/10">
                      <View className="flex-row justify-between">
                        <Text className="text-sm font-playfair text-neutral-600 dark:text-white/75">Subtotal</Text>
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                          ₹
                          {new Intl.NumberFormat("en-IN").format(
                            getCyclePrice(plans.find((p) => p.slug === selectedPlan), billingCycle) || 0
                          )}
                        </Text>
                      </View>
                      <View className="mt-1 flex-row justify-between">
                        <Text className="text-xs font-playfair text-neutral-500 dark:text-white/50">GST</Text>
                        <Text className="text-xs text-neutral-500 dark:text-white/50">₹0</Text>
                      </View>
                      <View className="mt-1 flex-row justify-between">
                        <Text className="text-xs font-playfair text-neutral-500 dark:text-white/50">Platform fee</Text>
                        <Text className="text-xs text-neutral-500 dark:text-white/50">₹0</Text>
                      </View>
                      <View className="mt-2 flex-row items-center justify-between border-t border-neutral-200 pt-2 dark:border-white/10">
                        <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Total</Text>
                        <Text className="text-xl font-newsreader-bold text-primary">
                          ₹
                          {new Intl.NumberFormat("en-IN").format(
                            getCyclePrice(plans.find((p) => p.slug === selectedPlan), billingCycle) || 0
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {!loadingPlans && selectedPlan ? (
                  <View className="mt-4">
                    <Text className="mb-2 text-sm font-playfair font-semibold text-neutral-900 dark:text-white/90">
                      Payment method
                    </Text>
                    <View className="flex-row gap-2">
                      {PAYMENT_METHODS.map((m) => {
                        const on = paymentMethod === m.key;
                        return (
                          <Pressable
                            key={m.key}
                            onPress={() => setPaymentMethod(m.key)}
                            className={[
                              "flex-1 items-center rounded-xl border-2 py-2.5",
                              on
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25"
                                : "border-neutral-200 dark:border-white/15",
                            ].join(" ")}
                          >
                            <Feather
                              name={m.icon}
                              size={18}
                              color={on ? "#4F46E5" : "#6B7280"}
                            />
                            <Text
                              className={[
                                "mt-1 text-center text-[10px] font-newsreader-bold",
                                on
                                  ? "text-indigo-800 dark:text-indigo-200"
                                  : "text-neutral-600 dark:text-white/70",
                              ].join(" ")}
                            >
                              {m.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {paymentMethod === "CARD" ? (
                      <View className="mt-3 gap-3">
                        <View>
                          <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">Card number</Text>
                          <TextInput
                            value={cardForm.number}
                            onChangeText={(v) => setCardForm((f) => ({ ...f, number: formatCardNumber(v) }))}
                            placeholder="1234 5678 9012 3456"
                            placeholderTextColor="rgba(156,163,175,0.9)"
                            keyboardType="number-pad"
                            maxLength={19}
                            className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </View>
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">Expiry</Text>
                            <TextInput
                              value={cardForm.expiry}
                              onChangeText={(v) => setCardForm((f) => ({ ...f, expiry: formatExpiry(v) }))}
                              placeholder="MM/YY"
                              placeholderTextColor="rgba(156,163,175,0.9)"
                              maxLength={5}
                              className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">CVV</Text>
                            <TextInput
                              value={cardForm.cvv}
                              onChangeText={(v) =>
                                setCardForm((f) => ({ ...f, cvv: v.replace(/\D/g, "").slice(0, 4) }))
                              }
                              placeholder="•••"
                              placeholderTextColor="rgba(156,163,175,0.9)"
                              keyboardType="number-pad"
                              secureTextEntry
                              maxLength={4}
                              className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                            />
                          </View>
                        </View>
                        <View>
                          <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">
                            Cardholder name
                          </Text>
                          <TextInput
                            value={cardForm.name}
                            onChangeText={(v) => setCardForm((f) => ({ ...f, name: v }))}
                            placeholder="John Doe"
                            placeholderTextColor="rgba(156,163,175,0.9)"
                            className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        </View>
                      </View>
                    ) : null}

                    {paymentMethod === "UPI" ? (
                      <View className="mt-3">
                        <Text className="mb-1 text-xs font-playfair text-neutral-600 dark:text-white/70">UPI ID</Text>
                        <TextInput
                          value={upiId}
                          onChangeText={setUpiId}
                          placeholder="yourname@upi"
                          placeholderTextColor="rgba(156,163,175,0.9)"
                          autoCapitalize="none"
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                        <Text className="mt-1 text-xs font-playfair text-neutral-400 dark:text-white/45">
                          Demo: enter a value like name@upi
                        </Text>
                      </View>
                    ) : null}

                    {paymentMethod === "NET_BANKING" ? (
                      <View className="mt-3">
                        <Text className="mb-2 text-xs font-playfair text-neutral-600 dark:text-white/70">Select bank</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {DEMO_BANKS.map((bank) => {
                            const on = selectedBank === bank;
                            return (
                              <Pressable
                                key={bank}
                                onPress={() => setSelectedBank(bank)}
                                className={[
                                  "min-w-[30%] flex-1 items-center rounded-lg border px-2 py-2",
                                  on
                                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25"
                                    : "border-neutral-200 dark:border-white/15",
                                ].join(" ")}
                              >
                                <Text
                                  className={[
                                    "text-center text-xs font-newsreader-bold",
                                    on
                                      ? "text-indigo-800 dark:text-indigo-200"
                                      : "text-neutral-700 dark:text-white/80",
                                  ].join(" ")}
                                >
                                  {bank}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Text className="mt-2 text-xs font-playfair text-neutral-400 dark:text-white/45">
                          Demo flow — no real bank redirect.
                        </Text>
                      </View>
                    ) : null}

                    <View className="mt-3 flex-row items-start gap-2">
                      <Feather name="shield" size={14} color="#9CA3AF" style={{ marginTop: 2 }} />
                      <Text className="flex-1 text-xs font-playfair leading-relaxed text-neutral-400 dark:text-white/45">
                        Your payment is secured with 256-bit SSL encryption. This is a demo payment gateway.
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleActivate}
                  disabled={isActivating || !selectedPlan}
                  className={[
                    "mt-6 h-12 items-center justify-center rounded-2xl bg-primary",
                    isActivating || !selectedPlan ? "opacity-50" : "",
                  ].join(" ")}
                >
                  {isActivating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-base font-newsreader-bold text-white">
                      {(() => {
                        const t = String(selectedTargetRoleName || userRole || "").toLowerCase();
                        const amt =
                          getCyclePrice(plans.find((p) => p.slug === selectedPlan), billingCycle) || 0;
                        const fmt = new Intl.NumberFormat("en-IN").format(amt);
                        if (t === "organizer") return `Pay ₹${fmt}`;
                        if (isUnlock && userRole === "player") return "Unlock role";
                        return isUnlock ? "Unlock & activate" : "Activate plan";
                      })()}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
