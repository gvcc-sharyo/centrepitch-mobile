import React from "react";

import { SCREENS } from "../../constants/navigation";
import AppTabs from "../AppTabs";
import OrganizerHomeStackNavigator from "./OrganizerHomeStackNavigator";
import OrganizerTeamsStackNavigator from "./OrganizerTeamsStackNavigator";
import OrganizerEventsStackNavigator from "./OrganizerEventsStackNavigator";
import OrganizerStaffStackNavigator from "./OrganizerStaffStackNavigator";
import OrganizerProfileStackNavigator from "./OrganizerProfileStackNavigator";

/**
 * Organizer shell: Home → Teams → Events → Staff → Profile (bottom tabs).
 * Each tab wraps its own native stack.
 */
export default function OrganizerNavigator() {
  const tabs = [
    { name: SCREENS.OrganizerTabHome, component: OrganizerHomeStackNavigator, label: "Home", icon: "home" },
    { name: SCREENS.OrganizerTabTeams, component: OrganizerTeamsStackNavigator, label: "Teams", icon: "users" },
    { name: SCREENS.OrganizerTabEvents, component: OrganizerEventsStackNavigator, label: "Events", icon: "calendar" },
    { name: SCREENS.OrganizerTabStaff, component: OrganizerStaffStackNavigator, label: "Staff", icon: "user-check" },
    { name: SCREENS.OrganizerTabProfile, component: OrganizerProfileStackNavigator, label: "Profile", icon: "user" },
  ];

  return <AppTabs tabs={tabs} initialRouteName={SCREENS.OrganizerTabHome} />;
}
