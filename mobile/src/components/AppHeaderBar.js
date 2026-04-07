import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import { navigateToHomeStack } from "../navigation/navigationRef";
import { openLocationPicker, selectLocationLabel, selectTheme, toggleMobileMenu } from "../store/slices/uiSlice";
import { selectUnreadCount } from "../store/slices/notificationSlice";
import { selectIsAuthenticated } from "../store/slices/authSlice";
import { SCREENS } from "../constants/navigation";
import RoleSwitcherMenu from "./RoleSwitcherMenu";

export default function AppHeaderBar({
  title,
  locationLabel: locationLabelProp,
  onPressLocation,
  showNotifications = true,
  showRoleSwitcher = true,
  showMenu = true,
  onPressMenu,
  /** When set, used instead of `navigateToHomeStack(Notifications)` (e.g. organizer tabs). */
  onPressNotifications,
}) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const locationFromStore = useSelector(selectLocationLabel);
  const unreadCount = Math.max(0, Number(useSelector(selectUnreadCount)) || 0);
  const isDark = theme === "dark";
  const locationLabel = locationLabelProp ?? locationFromStore;
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const topPad = useMemo(() => Math.max(insets.top, 10) + 10, [insets.top]);

  return (
    <View
      className="px-5 pb-5 pt-5"
      style={{ paddingTop: topPad }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPressLocation ?? (() => dispatch(openLocationPicker()))}
          accessibilityRole="button"
          accessibilityLabel="Change location"
          className="h-10 w-1/2 flex-row items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 dark:border-white/10 dark:bg-white/5"
        >
          <Feather
            name="map-pin"
            size={16}
            color={isDark ? "rgba(249,250,251,0.85)" : "rgba(17,24,39,0.75)"}
          />
          <Text className="w-[95px] text-sm font-playfair text-neutral-800 dark:text-white/85" numberOfLines={1}>
            {locationLabel}
          </Text>
          <Feather
            name="chevron-down"
            size={16}
            color={isDark ? "rgba(249,250,251,0.65)" : "rgba(17,24,39,0.55)"}
          />
        </Pressable>

        <View className="flex-row items-center gap-2">
          {showRoleSwitcher && isAuthenticated ? <RoleSwitcherMenu /> : null}
          {showNotifications ? (
            <Pressable
              onPress={() =>
                onPressNotifications ? onPressNotifications() : navigateToHomeStack(SCREENS.Notifications)
              }
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"
              }
              className="h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
            >
              <Feather
                name="bell"
                size={18}
                color={isDark ? "rgba(249,250,251,0.9)" : "rgba(17,24,39,0.8)"}
              />
              {unreadCount > 0 ? (
                <View
                  className="absolute min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1"
                  style={{ top: 4, right: 4 }}
                >
                  <Text
                    className="text-center text-[10px] font-playfair font-bold leading-none text-white"
                    numberOfLines={1}
                  >
                    {badgeLabel}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {showMenu ? (
            <Pressable
              onPress={onPressMenu ?? (() => dispatch(toggleMobileMenu()))}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              className="h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
            >
              <Feather
                name="menu"
                size={18}
                color={isDark ? "rgba(249,250,251,0.9)" : "rgba(17,24,39,0.8)"}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
