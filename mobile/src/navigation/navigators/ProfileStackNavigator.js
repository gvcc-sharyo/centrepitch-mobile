import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import Profile from "../../screens/common/Profile";
import Notifications from "../../screens/common/Notifications";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Profile tab + notifications. */
export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="ProfileHome" screenOptions={stackScreenOptions}>
      <Stack.Screen name="ProfileHome" component={Profile} />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} />
    </Stack.Navigator>
  );
}
