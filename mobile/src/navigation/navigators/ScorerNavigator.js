import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { stackScreenOptions } from "../defaultStackScreenOptions";
import Events from "../../screens/scorer/Events";

const Stack = createNativeStackNavigator();

export default function ScorerNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ScorerEvents" component={Events} />
    </Stack.Navigator>
  );
}

