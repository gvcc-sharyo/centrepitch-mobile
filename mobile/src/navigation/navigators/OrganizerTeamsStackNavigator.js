import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import OrganizerTeams from "../../screens/organizer/OrganizerTeams";
import OrganizerTeamDetail from "../../screens/organizer/OrganizerTeamDetail";
import OrganizerTeamPlayers from "../../screens/organizer/OrganizerTeamPlayers";
import OrganizerCreateTeam from "../../screens/organizer/OrganizerCreateTeam";
import OrganizerEditTeam from "../../screens/organizer/OrganizerEditTeam";
import OrganizerCoachTeams from "../../screens/organizer/OrganizerCoachTeams";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

export default function OrganizerTeamsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.OrganizerTeamsHome} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.OrganizerTeamsHome} component={OrganizerTeams} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerTeamDetail} component={OrganizerTeamDetail} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerTeamPlayers} component={OrganizerTeamPlayers} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerCreateTeam} component={OrganizerCreateTeam} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerEditTeam} component={OrganizerEditTeam} options={{ headerShown: false }} />
      <Stack.Screen name={SCREENS.OrganizerCoachTeams} component={OrganizerCoachTeams} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
