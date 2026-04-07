import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { stackScreenOptions } from "../defaultStackScreenOptions";
import AdminProfile from "../../screens/academy/AdminProfile";
import BookingDetail from "../../screens/academy/BookingDetail";
import Bookings from "../../screens/academy/Bookings";
import CoachDetail from "../../screens/academy/CoachDetail";
import CoachList from "../../screens/academy/CoachList";
import Coaches from "../../screens/academy/Coaches";
import CourtForm from "../../screens/academy/CourtForm";
import CourtPlanForm from "../../screens/academy/CourtPlanForm";
import CourtPlans from "../../screens/academy/CourtPlans";
import Courts from "../../screens/academy/Courts";
import JoinRequests from "../../screens/academy/JoinRequests";
import Revenue from "../../screens/academy/Revenue";
import Settings from "../../screens/academy/Settings";
import Staff from "../../screens/academy/Staff";
import TrainingSessions from "../../screens/academy/TrainingSessions";

import TeamAllPlayers from "../../screens/academy/Team/AllPlayers";
import TeamPlayers from "../../screens/academy/Team/Players";
import TeamDetail from "../../screens/academy/Team/TeamDetail";

const Stack = createNativeStackNavigator();

export default function AcademyNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="AcademyAdminProfile" component={AdminProfile} />
      <Stack.Screen name="AcademyBookings" component={Bookings} />
      <Stack.Screen name="AcademyBookingDetail" component={BookingDetail} />
      <Stack.Screen name="AcademyCoaches" component={Coaches} />
      <Stack.Screen name="AcademyCoachList" component={CoachList} />
      <Stack.Screen name="AcademyCoachDetail" component={CoachDetail} />
      <Stack.Screen name="AcademyCourts" component={Courts} />
      <Stack.Screen name="AcademyCourtForm" component={CourtForm} />
      <Stack.Screen name="AcademyCourtPlans" component={CourtPlans} />
      <Stack.Screen name="AcademyCourtPlanForm" component={CourtPlanForm} />
      <Stack.Screen name="AcademyJoinRequests" component={JoinRequests} />
      <Stack.Screen name="AcademyRevenue" component={Revenue} />
      <Stack.Screen name="AcademySettings" component={Settings} />
      <Stack.Screen name="AcademyStaff" component={Staff} />
      <Stack.Screen name="AcademyTrainingSessions" component={TrainingSessions} />

      <Stack.Screen name="AcademyTeamAllPlayers" component={TeamAllPlayers} />
      <Stack.Screen name="AcademyTeamPlayers" component={TeamPlayers} />
      <Stack.Screen name="AcademyTeamDetail" component={TeamDetail} />
    </Stack.Navigator>
  );
}

