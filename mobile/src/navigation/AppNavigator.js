import React, { useEffect, useLayoutEffect, useMemo } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { StatusBar } from "expo-status-bar";

import { applyThemeSystemChrome } from "../utils/themeSystemChrome";
import PublicNavigator from "./navigators/PublicNavigator";
import MainNavigator from "./MainNavigator";
import OnboardingNavigator from "./OnboardingNavigator";
import { navigationRef } from "./navigationRef";
import LocationBootstrap from "../components/LocationBootstrap";
import LocationPickerModal from "../components/LocationPickerModal";
import PlayerMenuModal from "../components/player/PlayerMenuModal";
import OrganizerMenuModal from "../components/organizer/OrganizerMenuModal";
import ToastHost from "../components/ToastHost";
import SystemAppearanceSync from "../components/SystemAppearanceSync";
import ThemePreferenceSync from "../components/ThemePreferenceSync";
import { selectTheme } from "../store/slices/uiSlice";
import { getMe, selectNeedsOnboarding } from "../store/slices/authSlice";
import { fetchUnreadCount } from "../store/slices/notificationSlice";
import { primary, primaryOnDark } from "../theme/tokens";

const selectIsAuthenticated = (state) => Boolean(state?.auth?.isAuthenticated);
const selectRole = (state) => String(state?.auth?.user?.role || "player").toLowerCase();

/** Theme shell inside NavigationContainer so all screens sit under navigation context. */
function ThemedRoot({ children }) {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  useLayoutEffect(() => {
    void applyThemeSystemChrome(isDark);
  }, [isDark]);

  return (
    <View className="flex-1">
      <StatusBar style={isDark ? "light" : "dark"} />
      <View className="flex-1 bg-white dark:bg-[#1F2B55] font-sans">{children}</View>
    </View>
  );
}

export default function AppNavigator() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const needsOnboarding = useSelector(selectNeedsOnboarding);
  const themeMode = useSelector(selectTheme);
  const role = useSelector(selectRole);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getMe());
      dispatch(fetchUnreadCount());
    }
  }, [dispatch, isAuthenticated]);

  const navigationTheme = useMemo(() => {
    const base = themeMode === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        // Keep navigation surfaces transparent so NativeWind root bg shows through
        background: "transparent",
        card: "transparent",
        text: themeMode === "dark" ? "#F9FAFB" : "#111827",
        border: themeMode === "dark" ? "#374151" : "#E5E7EB",
        primary: themeMode === "dark" ? primaryOnDark : primary.DEFAULT,
      },
    };
  }, [themeMode]);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <ThemePreferenceSync />
      <SystemAppearanceSync />
      <ThemedRoot>
        <LocationBootstrap />
        {isAuthenticated ? (needsOnboarding ? <OnboardingNavigator /> : <MainNavigator />) : <PublicNavigator />}
        <LocationPickerModal />
        {isAuthenticated && !needsOnboarding && role === "player" ? <PlayerMenuModal /> : null}
        {isAuthenticated && !needsOnboarding && role === "organizer" ? <OrganizerMenuModal /> : null}
        <ToastHost />
      </ThemedRoot>
    </NavigationContainer>
  );
}

