import React, { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import { goBackIfPossible } from "../../navigation/navigationRef";
import { selectTheme } from "../../store/slices/uiSlice";

/**
 * Organizer tab screens: header + optional back + title + body.
 * Notifications open the Profile tab stack; uses NativeWind for layout.
 */
export default function OrganizerScreenShell({ title, children, scrollable = true, showBack = true }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const { width } = useWindowDimensions();
  const isDark = theme === "dark";
  const iconColor = useMemo(
    () => (isDark ? "rgba(249,250,251,0.92)" : "rgba(17,24,39,0.88)"),
    [isDark]
  );

  const horizontalPad = width >= 768 ? Math.min(48, (width - 720) / 2) : 0;

  const onPressNotifications = useCallback(() => {
    navigation.navigate(SCREENS.OrganizerTabProfile, { screen: SCREENS.Notifications });
  }, [navigation]);

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar onPressNotifications={onPressNotifications} />
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
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 28,
            paddingLeft: Math.max(insets.left, 16) + horizontalPad,
            paddingRight: Math.max(insets.right, 16) + horizontalPad,
            paddingTop: 16,
            maxWidth: 720,
            width: "100%",
            alignSelf: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          className="flex-1"
          style={{
            paddingBottom: insets.bottom,
            paddingLeft: Math.max(insets.left, 16) + horizontalPad,
            paddingRight: Math.max(insets.right, 16) + horizontalPad,
            maxWidth: 720,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
