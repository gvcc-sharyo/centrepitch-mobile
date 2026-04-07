import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import MyEvents from "../../screens/organizer/MyEvents";
import CreateEvent from "../../screens/organizer/CreateEvent";
import EditEvent from "../../screens/organizer/EditEvent";
import MatchSchedule from "../../screens/organizer/MatchSchedule";
import OrganizerEventRegistrations from "../../screens/organizer/OrganizerEventRegistrations";
import OrganizerRescheduleEvent from "../../screens/organizer/OrganizerRescheduleEvent";
import EventDetails from "../../screens/common/EventDetails";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerEventsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerMyEvents} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerMyEvents} component={MyEvents} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerCreateEvent} component={CreateEvent} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEditEvent} component={EditEvent} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerMatchSchedule} component={MatchSchedule} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEventRegistrations} component={OrganizerEventRegistrations} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerRescheduleEvent} component={OrganizerRescheduleEvent} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.EventDetails} component={EventDetails} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
