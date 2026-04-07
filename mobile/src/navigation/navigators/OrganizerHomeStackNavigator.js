import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import OrganizerDashboard from "../../screens/organizer/OrganizerDashboard";
import Sports from "../../screens/organizer/Sports";
import ContactAdmin from "../../screens/organizer/ContactAdmin";
import MyQueries from "../../screens/organizer/MyQueries";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerHomeStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerDashboardHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerDashboardHome} component={OrganizerDashboard} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerSports} component={Sports} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerContactAdmin} component={ContactAdmin} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerMyQueriesScreen} component={MyQueries} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
