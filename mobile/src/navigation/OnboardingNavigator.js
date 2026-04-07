import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../constants/navigation";
import { stackScreenOptions } from "./defaultStackScreenOptions";
import MobileProfileSetup from "../screens/onboarding/MobileProfileSetup";
import MobileSportsSelection from "../screens/onboarding/MobileSportsSelection";

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={SCREENS.MobileProfileSetup}
      screenOptions={{ headerShown: false, ...stackScreenOptions }}
    >
      <Stack.Screen name={SCREENS.MobileProfileSetup} component={MobileProfileSetup} />
      <Stack.Screen name={SCREENS.MobileSportsSelection} component={MobileSportsSelection} />
    </Stack.Navigator>
  );
}
