import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import OrganizerTeams from "../../screens/organizer/OrganizerTeams";
import OrganizerTeamDetail from "../../screens/organizer/OrganizerTeamDetail";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerTeamsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerTeamsHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerTeamsHome} component={OrganizerTeams} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerTeamDetail} component={OrganizerTeamDetail} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
