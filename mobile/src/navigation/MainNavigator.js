import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector } from "react-redux";

import { SCREENS } from "../constants/navigation";

import VerifyAccount from "../screens/auth/VerifyAccount";

import { stackScreenOptions } from "./defaultStackScreenOptions";
import PublicNavigator from "./navigators/PublicNavigator";
import PlayerNavigator from "./navigators/PlayerNavigator";
import AdminNavigator from "./navigators/AdminNavigator";
import OrganizerNavigator from "./navigators/OrganizerNavigator";
import AcademyNavigator from "./navigators/AcademyNavigator";
import CoachNavigator from "./navigators/CoachNavigator";
import ScorerNavigator from "./navigators/ScorerNavigator";

const Stack = createNativeStackNavigator();
const selectRole = (s) => String(s?.auth?.user?.role || "player").toLowerCase();

export default function MainNavigator() {
  const role = useSelector(selectRole);

  const RoleRoot =
    role === "superadmin"
      ? AdminNavigator
      : role === "organizer"
      ? OrganizerNavigator
      : role === "academyadmin"
      ? AcademyNavigator
      : role === "coach"
      ? CoachNavigator
      : role === "scorer"
      ? ScorerNavigator
      : PlayerNavigator;

  return (
    <Stack.Navigator initialRouteName="RoleRoot" screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.VerifyAccount} component={VerifyAccount} />

      <Stack.Screen name="PublicRoot" component={PublicNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="RoleRoot" component={RoleRoot} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
