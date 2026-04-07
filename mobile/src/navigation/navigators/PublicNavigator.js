import React, { useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import { selectOpenLoginOnPublicMount } from "../../store/slices/authSlice";
import { stackScreenOptions } from "../defaultStackScreenOptions";

import Landingpage from "../../screens/landingPage/Landingpage";
import OnBoardingScreen from "../../screens/onboarding/OnBoardingScreen";
import Home from "../../screens/public/Home";
import Contact from "../../screens/public/Contact";
import Events from "../../screens/public/Events";
import BrowseEvents from "../../screens/public/events/BrowseEvents";
import BrowseAcademies from "../../screens/public/academies/BrowseAcademies";
import AcademyScreen from "../../screens/public/academies/AcademyScreen";
import BrowseCoaches from "../../screens/public/coaches/BrowseCoaches";
import CoachScreen from "../../screens/public/coaches/CoachScreen";
import BrowseCourts from "../../screens/public/courts/BrowseCourts";
import CourtScreen from "../../screens/public/courts/CourtScreen";
import Login from "../../screens/auth/Login";
import PasswordLogin from "../../screens/auth/PasswordLogin";
import ForgotPassword from "../../screens/auth/ForgotPassword";
import ResetPassword from "../../screens/auth/ResetPassword";
import VerifyAccount from "../../screens/auth/VerifyAccount";
import AdminLogin from "../../screens/auth/AdminLogin";

const Stack = createNativeStackNavigator();

export default function PublicNavigator() {
  const openLoginOnPublicMount = useSelector(selectOpenLoginOnPublicMount);
  /** Lock once per mount so clearing `openLoginOnPublicMount` after login does not switch the stack back to onboarding. */
  const [initialRouteName] = useState(() =>
    openLoginOnPublicMount ? SCREENS.Login : SCREENS.OnBoardingScreen
  );

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, ...stackScreenOptions }}
    >
      <Stack.Screen
        name={SCREENS.OnBoardingScreen}
        component={OnBoardingScreen}
        options={{ statusBarStyle: "light" }}
      />
      <Stack.Screen
        name={SCREENS.Landingpage}
        component={Landingpage}
        options={{ statusBarStyle: "light" }}
      />
      <Stack.Screen name={SCREENS.Home} component={Home} />
      <Stack.Screen name={SCREENS.Contact} component={Contact} />
      <Stack.Screen name={SCREENS.Events} component={Events} />
      <Stack.Screen name={SCREENS.PublicBrowseEvents} component={BrowseEvents} />
      <Stack.Screen name={SCREENS.BrowseAcademies} component={BrowseAcademies} />
      <Stack.Screen name={SCREENS.AcademyScreen} component={AcademyScreen} />
      <Stack.Screen name={SCREENS.BrowseCoaches} component={BrowseCoaches} />
      <Stack.Screen name={SCREENS.CoachScreen} component={CoachScreen} />
      <Stack.Screen name={SCREENS.BrowseCourts} component={BrowseCourts} />
      <Stack.Screen name={SCREENS.CourtScreen} component={CourtScreen} />

      {/* Auth screens (reachable from Landing / public routes) */}
      <Stack.Screen name={SCREENS.Login} component={Login} />
      <Stack.Screen name={SCREENS.PasswordLogin} component={PasswordLogin} />
      <Stack.Screen name={SCREENS.AdminLogin} component={AdminLogin} />
      <Stack.Screen name={SCREENS.ForgotPassword} component={ForgotPassword} />
      <Stack.Screen name={SCREENS.ResetPassword} component={ResetPassword} />
      <Stack.Screen name={SCREENS.VerifyAccount} component={VerifyAccount} />
    </Stack.Navigator>
  );
}

