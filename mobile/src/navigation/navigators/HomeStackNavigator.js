import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import Dashboard from "../../screens/common/Dashboard";
import Notifications from "../../screens/common/Notifications";
import BrowseCourts from "../../screens/public/courts/BrowseCourts";
import CoachScreen from "../../screens/public/coaches/CoachScreen";
import CourtScreen from "../../screens/public/courts/CourtScreen";
import EventDetails from "../../screens/common/EventDetails";
import Settings from "../../screens/common/Settings";
import FindCoach from "../../screens/player/FindCoach";
import TeamInvites from "../../screens/player/TeamInvites";
import MyEvents from "../../screens/player/MyEvents";
import MyMatches from "../../screens/player/MyMatches";
import EventTracker from "../../screens/player/EventTracker";
import AttendedEvents from "../../screens/player/AttendedEvents";
import MySubscriptions from "../../screens/player/MySubscriptions";
import SubscriptionDetails from "../../screens/player/SubscriptionDetails";
import MyBookings from "../../screens/player/bookings/MyBookings";
import BookingDetails from "../../screens/player/bookings/BookingDetails";
import TeamRegistration from "../../screens/player/TeamRegistration";
import BookCourt from "../../screens/player/courts/BookCourt";
import AcademyStackNavigator from "./AcademyStackNavigator";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/**
 * Home tab: dashboard, courts, player menu destinations, coach/court/event details, settings.
 * Keeps bottom tabs + shared header visible when pushing these screens.
 */
export default function HomeStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.DashboardHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.DashboardHome} component={Dashboard} />
      <Stack.Screen name={SCREENS.BrowseCourts} component={BrowseCourts} />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} />

      <Stack.Screen name={SCREENS.PlayerFindCoach} component={FindCoach} />
      <Stack.Screen name={SCREENS.TeamInvites} component={TeamInvites} />
      <Stack.Screen name={SCREENS.MyEvents} component={MyEvents} />
      <Stack.Screen name={SCREENS.MyMatches} component={MyMatches} />
      <Stack.Screen name={SCREENS.EventTracker} component={EventTracker} />
      <Stack.Screen name={SCREENS.AttendedMatches} component={AttendedEvents} />
      <Stack.Screen name={SCREENS.MyBookings} component={MyBookings} />
      <Stack.Screen name={SCREENS.BookingDetails} component={BookingDetails} />
      <Stack.Screen name={SCREENS.MySubscriptions} component={MySubscriptions} />
      <Stack.Screen name={SCREENS.SubscriptionDetails} component={SubscriptionDetails} />
      <Stack.Screen name={SCREENS.Settings} component={Settings} />

      <Stack.Screen name={SCREENS.CoachScreen} component={CoachScreen} />
      <Stack.Screen name={SCREENS.CourtScreen} component={CourtScreen} />
      <Stack.Screen name={SCREENS.EventDetails} component={EventDetails} />
      <Stack.Screen name={SCREENS.TeamRegistration} component={TeamRegistration} />
      <Stack.Screen name={SCREENS.PlayerBrowseCourts} component={BrowseCourts} />
      <Stack.Screen name={SCREENS.PlayerCourtDetails} component={CourtScreen} />
      <Stack.Screen name={SCREENS.BookCourt} component={BookCourt} />

      <Stack.Screen
        name={SCREENS.AcademyStack}
        component={AcademyStackNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
