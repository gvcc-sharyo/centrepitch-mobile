import { SCREENS } from "../constants/navigation";

import HomeStackNavigator from "./navigators/HomeStackNavigator";
import EventsStackNavigator from "./navigators/EventsStackNavigator";
import AnalyticsStackNavigator from "./navigators/AnalyticsStackNavigator";
import TeamsStackNavigator from "./navigators/TeamsStackNavigator";
import ProfileStackNavigator from "./navigators/ProfileStackNavigator";

export function getTabsForRole(role) {
  const r = String(role || "player").toLowerCase();
  if (r === "player") {
    return [
      { name: SCREENS.Dashboard, component: HomeStackNavigator, label: "Home", icon: "home" },
      { name: SCREENS.EventsStack, component: EventsStackNavigator, label: "Events", icon: "calendar" },
      { name: SCREENS.AnalyticsStack, component: AnalyticsStackNavigator, label: "Analytics", icon: "bar-chart-2" },
      { name: SCREENS.Teams, component: TeamsStackNavigator, label: "Teams", icon: "users" },
      { name: SCREENS.Profile, component: ProfileStackNavigator, label: "Profile", icon: "user" },
    ];
  }

  return getTabsForRole("player");
}
