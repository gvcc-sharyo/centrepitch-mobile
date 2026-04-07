import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import Teams from "../../screens/common/Teams";
import Notifications from "../../screens/common/Notifications";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Teams tab + notifications. */
export default function TeamsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="TeamsHome" screenOptions={stackScreenOptions}>
      <Stack.Screen name="TeamsHome" component={Teams} />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} />
    </Stack.Navigator>
  );
}
