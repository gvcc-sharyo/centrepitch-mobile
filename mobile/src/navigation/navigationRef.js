import { createNavigationContainerRef } from "@react-navigation/native";

import { SCREENS } from "../constants/navigation";

/** Root ref for navigating from components outside screen trees (e.g. player menu modal). */
export const navigationRef = createNavigationContainerRef();

/** Home tab stack screens (notifications, settings, …) — same target as `PlayerMenuModal`. */
export function navigateToHomeStack(screen, params) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("RoleRoot", {
    screen: SCREENS.Dashboard,
    params: params ? { screen, params } : { screen },
  });
}

/** Switch to Events tab and optionally reset to a stack screen (e.g. browse list). */
export function navigateToEventsStack(screen = SCREENS.EventsHome, params) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("RoleRoot", {
    screen: SCREENS.EventsStack,
    params: params ? { screen, params } : { screen },
  });
}

/** Organizer role: switch tab and optional nested stack screen. */
export function navigateToOrganizerTab(tabName, screen, params) {
  if (!navigationRef.isReady()) return;
  if (screen) {
    navigationRef.navigate("RoleRoot", {
      screen: tabName,
      params: params ? { screen, params } : { screen },
    });
  } else {
    navigationRef.navigate("RoleRoot", { screen: tabName });
  }
}

export function goBackIfPossible() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
