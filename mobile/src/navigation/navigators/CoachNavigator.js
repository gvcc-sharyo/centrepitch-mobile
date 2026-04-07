import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { stackScreenOptions } from "../defaultStackScreenOptions";
import AddStudent from "../../screens/coach/AddStudent";
import Bookings from "../../screens/coach/Bookings";
import Sessions from "../../screens/coach/Sessions";
import Students from "../../screens/coach/Students";
import TeamDetail from "../../screens/coach/TeamDetail";
import TeamPlayers from "../../screens/coach/TeamPlayers";

const Stack = createNativeStackNavigator();

export default function CoachNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="CoachSessions" component={Sessions} />
      <Stack.Screen name="CoachStudents" component={Students} />
      <Stack.Screen name="CoachAddStudent" component={AddStudent} />
      <Stack.Screen name="CoachBookings" component={Bookings} />
      <Stack.Screen name="CoachTeamDetail" component={TeamDetail} />
      <Stack.Screen name="CoachTeamPlayers" component={TeamPlayers} />
    </Stack.Navigator>
  );
}

