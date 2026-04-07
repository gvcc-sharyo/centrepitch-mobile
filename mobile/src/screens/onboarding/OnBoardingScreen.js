import React from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, Text, View } from "react-native";
import { useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import HeaderBar from "../../components/HeaderBar";
import { selectTheme } from "../../store/slices/uiSlice";
import OnboardingCarousel from "./components/OnboardingCarousel";

export default function OnBoardingScreen() {
  const navigation = useNavigation();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <SafeAreaView className="flex-1">
        <HeaderBar isDark={isDark} topInset={insets.top} />

        <OnboardingCarousel isDark={isDark} />

        <View className="px-5 py-4">
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate(SCREENS.Login)}
            className="h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary"
          >
            <Text className="text-base font-newsreader-bold text-white">Get Started</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
