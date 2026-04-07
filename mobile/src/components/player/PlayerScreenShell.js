import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import AppHeaderBar from "../AppHeaderBar";
import { goBackIfPossible } from "../../navigation/navigationRef";
import { selectTheme } from "../../store/slices/uiSlice";

/**
 * Player menu / sub-screens: global AppHeaderBar (location, bell, menu) + optional back + title + body.
 * Bottom tab bar remains visible (screens live in Home stack).
 */
export default function PlayerScreenShell({ title, children, scrollable = true, showBack = true }) {
  const insets = useSafeAreaInsets();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.92)" : "rgba(17,24,39,0.88)";

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar />
      {title ? (
        <View className="flex-row items-center border-b border-neutral-200 px-4 py-2 dark:border-white/10">
          {showBack ? (
            <Pressable
              onPress={() => goBackIfPossible()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="mr-2 rounded-full bg-neutral-100 p-2 dark:bg-white/10"
            >
              <Feather name="arrow-left" size={22} color={iconColor} />
            </Pressable>
          ) : null}
          <Text
            className="flex-1 font-newsreader-bold text-lg text-neutral-900 dark:text-white"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      ) : null}
      {scrollable ? (
        <ScrollView
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-4 pt-4" style={{ paddingBottom: insets.bottom }}>
          {children}
        </View>
      )}
    </View>
  );
}
