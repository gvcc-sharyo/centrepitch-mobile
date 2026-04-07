import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import Profile from "../../screens/common/Profile";
import Notifications from "../../screens/common/Notifications";
import Settings from "../../screens/common/Settings";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Profile tab: account, notifications, settings (organizer uses `organizerShell` on Profile/Settings). */
export default function OrganizerProfileStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerProfileHome} screenOptions={stackScreenOptions}>
      <Stack.Screen
        name={SCREENS.OrganizerProfileHome}
        component={Profile}
        initialParams={{ organizerShell: true }}
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
