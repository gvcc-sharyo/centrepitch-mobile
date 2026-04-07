import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import MyEvents from "../../screens/organizer/MyEvents";
import CreateEvent from "../../screens/organizer/CreateEvent";
import EditEvent from "../../screens/organizer/EditEvent";
import MatchSchedule from "../../screens/organizer/MatchSchedule";
import OrganizerEventRegistrations from "../../screens/organizer/OrganizerEventRegistrations";
import OrganizerRescheduleEvent from "../../screens/organizer/OrganizerRescheduleEvent";
import OrganizerEventAnnouncement from "../../screens/organizer/OrganizerEventAnnouncement";
import OrganizerEventRevenue from "../../screens/organizer/OrganizerEventRevenue";
import OrganizerEventScorers from "../../screens/organizer/OrganizerEventScorers";
import OrganizerAddTeamToEvent from "../../screens/organizer/OrganizerAddTeamToEvent";
import OrganizerEventStaff from "../../screens/organizer/OrganizerEventStaff";
import OrganizerBulkNotifications from "../../screens/organizer/OrganizerBulkNotifications";
import OrganizerRegisteredPlayers from "../../screens/organizer/OrganizerRegisteredPlayers";
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
      <Stack.Screen name={SCREENS.OrganizerEventAnnouncement} component={OrganizerEventAnnouncement} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEventRevenue} component={OrganizerEventRevenue} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEventScorers} component={OrganizerEventScorers} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerAddTeamToEvent} component={OrganizerAddTeamToEvent} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEventStaff} component={OrganizerEventStaff} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerBulkNotifications} component={OrganizerBulkNotifications} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerRegisteredPlayers} component={OrganizerRegisteredPlayers} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.EventDetails} component={EventDetails} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
