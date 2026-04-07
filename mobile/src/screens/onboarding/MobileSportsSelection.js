import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import sportService from "../../services/sportService";
import {
  completeMobileOnboarding,
  selectAuthLoading,
  selectMobileOnboardingProfilePhoto,
} from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { toast } from "../../utils/toast";
import HeaderBar from "../../components/HeaderBar";

function normalizeSportDocId(id) {
  if (id == null) return null;
  if (typeof id === "object" && id._id) return String(id._id);
  return String(id);
}

export default function MobileSportsSelection({ navigation, route }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const isLoading = useSelector(selectAuthLoading);
  const onboardingProfilePhoto = useSelector(selectMobileOnboardingProfilePhoto);
  const insets = useSafeAreaInsets();

  const { firstName, lastName } = route.params || {};

  useEffect(() => {
    if (
      !firstName ||
      String(firstName).trim().length < 1 ||
      !lastName ||
      String(lastName).trim().length < 1
    ) {
      navigation.replace(SCREENS.MobileProfileSetup);
    }
  }, [firstName, lastName, navigation]);

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingSports(true);
        const res = await sportService.getSportsList();
        const list = res?.data ?? res ?? [];
        const rows = Array.isArray(list) ? list : [];
        if (!cancelled) {
          setSports(
            rows.map((s) => ({
              _id: normalizeSportDocId(s._id || s.id),
              name: typeof s.name === "string" ? s.name : s?.name?.en || "",
            }))
          );
        }
      } catch {
        if (!cancelled) setSports([]);
      } finally {
        if (!cancelled) setLoadingSports(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const canFinish = useMemo(() => selectedIds.size >= 1, [selectedIds.size]);

  const onFinish = () => {
    if (!canFinish || !firstName) {
      toast.error("Select at least one sport.");
      return;
    }
    const sportIds = [...selectedIds];
    const body = {
      firstName,
      lastName: lastName || "",
      sportIds,
    };
    if (typeof onboardingProfilePhoto === "string" && onboardingProfilePhoto.trim()) {
      body.profilePhoto = onboardingProfilePhoto;
    }
    dispatch(completeMobileOnboarding(body)).then((result) => {
      if (completeMobileOnboarding.fulfilled.match(result)) {
        toast.success("You're all set.");
      } else if (completeMobileOnboarding.rejected.match(result)) {
        toast.error(result.payload || "Could not save.");
      }
    });
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeaderBar isDark={isDark} topInset={insets.top} onPressLogo={() => {}} />

        <View className="px-5 pt-2">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            className="mb-3 flex-row items-center gap-1 self-start py-1"
          >
            <Feather name="chevron-left" size={20} color={isDark ? "#F9FAFB" : "#111827"} />
            <Text className="text-sm font-playfair font-semibold text-neutral-700 dark:text-white/80">Back</Text>
          </Pressable>

          <Text className="text-3xl font-newsreader-bold text-neutral-900 dark:text-white text-center">
            Your sports
          </Text>
          <Text className="mt-1.5 text-sm font-playfair text-neutral-600 dark:text-white/70 text-center">
            Choose one or more sports you care about.
          </Text>

          {loadingSports ? (
            <View className="mt-10 items-center">
              <ActivityIndicator />
            </View>
          ) : (
            <View className="mt-6 flex-row flex-wrap gap-2">
              {sports.map((s) => {
                const id = String(s._id || "");
                if (!id) return null;
                const on = selectedIds.has(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggle(id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={[
                      "rounded-full border px-4 py-2.5",
                      on
                        ? "border-primary bg-primary"
                        : "border-neutral-200 bg-white dark:border-white/15 dark:bg-white/5",
                    ].join(" ")}
                  >
                    <Text
                      className={[
                        "text-sm font-playfair font-semibold",
                        on ? "text-white" : "text-neutral-800 dark:text-white/90",
                      ].join(" ")}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={onFinish}
            disabled={!canFinish || isLoading}
            accessibilityRole="button"
            className={[
              "mt-8 h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary",
              canFinish && !isLoading ? "opacity-100" : "opacity-55",
            ].join(" ")}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text className="text-base font-newsreader-bold text-white">Finish</Text>
                <Feather name="check" size={18} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
