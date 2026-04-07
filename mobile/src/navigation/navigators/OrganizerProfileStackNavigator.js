import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import OrganizerProfile from "../../screens/organizer/OrganizerProfile";
import Notifications from "../../screens/common/Notifications";
import Settings from "../../screens/common/Settings";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Profile tab: organizer account + organization (parity with web `/organizer/profile`). */
export default function OrganizerProfileStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerProfileHome} screenOptions={stackScreenOptions}>
      <Stack.Screen
        name={SCREENS.OrganizerProfileHome}
        component={OrganizerProfile}
        options={{ headerShown: false }}
      />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} options={{ headerShown: false }} />
      <Stack.Screen
        name={SCREENS.Settings}
        component={Settings}
        initialParams={{ organizerShell: true }}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
