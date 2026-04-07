import React from "react";
import { useSelector } from "react-redux";

import AppTabs from "../AppTabs";
import { getTabsForRole } from "../tabConfigs";

const selectRole = (s) => String(s?.auth?.user?.role || "player").toLowerCase();

export default function PlayerNavigator() {
  const role = useSelector(selectRole);
  const tabs = getTabsForRole(role);

  return (
    <AppTabs tabs={tabs} initialRouteName={tabs?.[0]?.name} />
  );
}

