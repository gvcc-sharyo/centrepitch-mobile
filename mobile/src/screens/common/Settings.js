import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import {
  selectTheme,
  selectThemePreference,
  setThemePreference,
} from "../../store/slices/uiSlice";

const OPTIONS = [
  { value: "light", label: "Light", icon: "sun", subtitle: null },
  { value: "dark", label: "Dark", icon: "moon", subtitle: null },
  { value: "system", label: "Device", icon: "tablet", subtitle: "Match system setting" },
];

const GREEN = "#0A763A";
const GREEN_LIGHT = "#86efac";

/** Redux-resolved — same pattern for light & dark: card fill + green when selected (no borders). */
function themeOptionRowClasses(selected, isDark) {
  const base = "min-h-14 w-full flex-row items-center gap-3 rounded-[14px] border-0 px-3.5 py-3.5";
  if (selected) {
    return isDark ? `${base} bg-[#0f2918]` : `${base} bg-[#d1fae5]`;
  }
  return isDark ? `${base} bg-[#2d3f6b]` : `${base} bg-[#e8eef5]`;
}

function themeOptionIconTileClasses(selected, isDark) {
  if (isDark) {
    return selected ? "bg-[#163d2e]" : "bg-[#3d5280]";
  }
  return selected ? "bg-[#bbf7d0]/80" : "bg-[#cbd5e1]";
}

function themeOptionIconColor(selected, isDark) {
  if (selected) return isDark ? GREEN_LIGHT : GREEN;
  return isDark ? "#ffffff" : "#1f2937";
}

/** Inline colors — NativeWind `text-*` on these rows was not reliably painting (inactive looked blank). */
function themeOptionTitleColor(selected, isDark) {
  if (selected) return isDark ? GREEN_LIGHT : GREEN;
  return isDark ? "#ffffff" : "#111827";
}

function themeOptionSubtitleColor(selected, isDark) {
  if (selected) return isDark ? GREEN_LIGHT : GREEN;
  return isDark ? "#e5e7eb" : "#4b5563";
}

export default function Settings() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const organizerShell = Boolean(route.params?.organizerShell);
  const preference = useSelector(selectThemePreference);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.92)" : "rgba(17,24,39,0.88)";

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar
        {...(organizerShell
          ? { onPressNotifications: () => navigation.navigate(SCREENS.Notifications) }
          : {})}
      />
      {navigation.canGoBack() ? (
        <View className="flex-row items-center border-b border-neutral-200 px-4 py-2 dark:border-white/10">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="mr-2 rounded-full bg-neutral-100 p-2 dark:bg-white/10"
          >
            <Feather name="arrow-left" size={22} color={iconColor} />
          </Pressable>
          <Text className="flex-1 font-newsreader-bold text-lg text-neutral-900 dark:text-white">Settings</Text>
        </View>
      ) : (
        <View className="px-5 pt-2">
          <Text className="font-newsreader-bold text-2xl text-neutral-900 dark:text-white">Settings</Text>
        </View>
      )}
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-5 pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-2 font-newsreader-bold text-lg text-neutral-900 dark:text-white">Appearance</Text>
        <Text className="mb-4 font-playfair text-sm text-neutral-600 dark:text-white/60">
          Choose light, dark, or match your device.
        </Text>
        <View accessibilityRole="radiogroup" className="gap-2.5">
          {OPTIONS.map((opt) => {
            const selected = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => dispatch(setThemePreference(opt.value))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  opt.subtitle ? `${opt.label}. ${opt.subtitle}` : opt.label
                }
                android_ripple={
                  isDark
                    ? { color: "rgba(255, 255, 255, 0.12)" }
                    : { color: "rgba(10, 118, 58, 0.15)" }
                }
                className="w-full"
              >
                <View className={themeOptionRowClasses(selected, isDark)}>
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-xl ${themeOptionIconTileClasses(selected, isDark)}`}
                  >
                    <Feather name={opt.icon} size={22} color={themeOptionIconColor(selected, isDark)} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className={[
                        "font-playfair text-[17px] leading-snug",
                        selected ? "font-semibold" : "font-medium",
                      ].join(" ")}
                      style={{ color: themeOptionTitleColor(selected, isDark) }}
                    >
                      {opt.label}
                    </Text>
                    {opt.subtitle ? (
                      <Text
                        className="mt-1 font-playfair text-xs leading-relaxed"
                        style={{ color: themeOptionSubtitleColor(selected, isDark) }}
                      >
                        {opt.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
