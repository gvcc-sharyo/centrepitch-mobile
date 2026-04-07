import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import OrganizerDashboard from "../../screens/organizer/OrganizerDashboard";
import Sports from "../../screens/organizer/Sports";
import OrganizerSportConfigurationForm from "../../screens/organizer/OrganizerSportConfigurationForm";
import ContactAdmin from "../../screens/organizer/ContactAdmin";
import MyQueries from "../../screens/organizer/MyQueries";
import OrganizerRevenueAnalytics from "../../screens/organizer/OrganizerRevenueAnalytics";
import OrganizerScorers from "../../screens/organizer/OrganizerScorers";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerHomeStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerDashboardHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerDashboardHome} component={OrganizerDashboard} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerSports} component={Sports} options={{ headerShown: false }} />
      <Stack.Screen
        name={SCREENS.OrganizerSportConfiguration}
        component={OrganizerSportConfigurationForm}
        options={{ headerShown: false }}
      />
      <Stack.Screen name={SCREENS.OrganizerContactAdmin} component={ContactAdmin} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerMyQueriesScreen} component={MyQueries} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerRevenueAnalytics} component={OrganizerRevenueAnalytics} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerScorers} component={OrganizerScorers} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
