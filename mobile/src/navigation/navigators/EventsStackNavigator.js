import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import BrowseEvents from "../../screens/public/events/BrowseEvents";
import EventDetails from "../../screens/common/EventDetails";
import Notifications from "../../screens/common/Notifications";
import TeamRegistration from "../../screens/player/TeamRegistration";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Events tab: browse + details + notifications (header + tabs stay visible). */
export default function EventsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.EventsHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.EventsHome} component={BrowseEvents} />
      <Stack.Screen name={SCREENS.EventDetails} component={EventDetails} />
      <Stack.Screen name={SCREENS.TeamRegistration} component={TeamRegistration} />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} />
    </Stack.Navigator>
  );
}
