import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import Staff from "../../screens/organizer/Staff";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerStaffStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerStaffHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerStaffHome} component={Staff} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
