import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import BrowseAcademies from "../../screens/public/academies/BrowseAcademies";
import AcademyScreen from "../../screens/public/academies/AcademyScreen";
import CoachScreen from "../../screens/public/coaches/CoachScreen";
import CourtScreen from "../../screens/public/courts/CourtScreen";
import Notifications from "../../screens/common/Notifications";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Academy tab: academies + academy detail + coach/court + notifications. */
export default function AcademyStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.BrowseAcademies} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.BrowseAcademies} component={BrowseAcademies} />
      <Stack.Screen name={SCREENS.AcademyScreen} component={AcademyScreen} />
      <Stack.Screen name={SCREENS.CoachScreen} component={CoachScreen} />
      <Stack.Screen name={SCREENS.CourtScreen} component={CourtScreen} />
      <Stack.Screen name={SCREENS.Notifications} component={Notifications} />
    </Stack.Navigator>
  );
}
