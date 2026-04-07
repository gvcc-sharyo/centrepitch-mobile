import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { SCREENS } from "../constants/navigation";
import { stackScreenOptions } from "./defaultStackScreenOptions";

import Login from "../screens/auth/Login";
import AdminLogin from "../screens/auth/AdminLogin";
import ForgotPassword from "../screens/auth/ForgotPassword";
import ResetPassword from "../screens/auth/ResetPassword";
import VerifyAccount from "../screens/auth/VerifyAccount";

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...stackScreenOptions }}>
      <Stack.Screen name={SCREENS.Login} component={Login} />
      <Stack.Screen name={SCREENS.AdminLogin} component={AdminLogin} />
      <Stack.Screen name={SCREENS.ForgotPassword} component={ForgotPassword} />
      <Stack.Screen name={SCREENS.ResetPassword} component={ResetPassword} />
      <Stack.Screen name={SCREENS.VerifyAccount} component={VerifyAccount} />
    </Stack.Navigator>
  );
}

