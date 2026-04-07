import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../../constants/navigation";
import PlayerAnalytics from "../../screens/player/PlayerAnalytics";
import PlayerMatchAnalytics from "../../screens/player/PlayerMatchAnalytics";
import { stackScreenOptions } from "../defaultStackScreenOptions";

const Stack = createNativeStackNavigator();

/** Player tab: performance analytics (CentrePitch → CA-1). */
export default function AnalyticsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName={SCREENS.PlayerAnalytics} screenOptions={stackScreenOptions}>
      <Stack.Screen name={SCREENS.PlayerAnalytics} component={PlayerAnalytics} />
      <Stack.Screen name={SCREENS.PlayerMatchAnalytics} component={PlayerMatchAnalytics} />
    </Stack.Navigator>
  );
}
