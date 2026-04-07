import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { stackScreenOptions } from "../defaultStackScreenOptions";
import AllEvents from "../../screens/admin/AllEvents";
import MyEvents from "../../screens/admin/MyEvents";
import AllPlayers from "../../screens/admin/AllPlayers";
import Organizers from "../../screens/admin/Organizers";
import CreateEvent from "../../screens/admin/CreateEvent";
import EditEvent from "../../screens/admin/EditEvent";
import EventPublishPricing from "../../screens/admin/EventPublishPricing";
import Queries from "../../screens/admin/Queries";
import Registrations from "../../screens/admin/Registrations";
import Sports from "../../screens/admin/Sports";
import SubscriptionHistory from "../../screens/admin/SubscriptionHistory";

import AllAcademies from "../../screens/admin/academies/AllAcademies";
import PendingAcademies from "../../screens/admin/academies/PendingAcademies";
import AcademyDetails from "../../screens/admin/academies/AcademyDetails";

import AllCoaches from "../../screens/admin/coaches/AllCoaches";
import PendingCoaches from "../../screens/admin/coaches/PendingCoaches";
import CoachDetails from "../../screens/admin/coaches/CoachDetails";

import AllCourts from "../../screens/admin/courts/AllCourts";
import CourtDetails from "../../screens/admin/courts/CourtDetails";

import AllBookings from "../../screens/bookings/AllBookings";

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="AllEvents" component={AllEvents} />
      <Stack.Screen name="MyEvents" component={MyEvents} />
      <Stack.Screen name="AllPlayers" component={AllPlayers} />
      <Stack.Screen name="Organizers" component={Organizers} />
      <Stack.Screen name="CreateEvent" component={CreateEvent} />
      <Stack.Screen name="EditEvent" component={EditEvent} />
      <Stack.Screen name="EventPublishPricing" component={EventPublishPricing} />
      <Stack.Screen name="Queries" component={Queries} />
      <Stack.Screen name="Registrations" component={Registrations} />
      <Stack.Screen name="Sports" component={Sports} />
      <Stack.Screen name="SubscriptionHistory" component={SubscriptionHistory} />

      <Stack.Screen name="AllAcademies" component={AllAcademies} />
      <Stack.Screen name="PendingAcademies" component={PendingAcademies} />
      <Stack.Screen name="AcademyDetails" component={AcademyDetails} />

      <Stack.Screen name="AllCoaches" component={AllCoaches} />
      <Stack.Screen name="PendingCoaches" component={PendingCoaches} />
      <Stack.Screen name="CoachDetails" component={CoachDetails} />

      <Stack.Screen name="AllCourts" component={AllCourts} />
      <Stack.Screen name="CourtDetails" component={CourtDetails} />

      <Stack.Screen name="AllBookings" component={AllBookings} />
    </Stack.Navigator>
  );
}

