import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";

import AppHeaderBar from "../../../components/AppHeaderBar";
import { SCREENS } from "../../../constants/navigation";

/**
 * Entry point for court booking: reuses the public browse list (same as dashboard shortcut).
 */
export default function BookCourt() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Book a court" />
      <View
        className="flex-1 justify-center px-6"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="items-center rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <Feather name="map-pin" size={40} color="#1F2B55" />
          <Text className="mt-4 text-center text-lg font-newsreader-bold text-neutral-900 dark:text-white">
            Find a court
          </Text>
          <Text className="mt-2 text-center text-sm font-playfair leading-5 text-neutral-600 dark:text-white/70">
            Browse available courts, then open a listing for details and booking options.
          </Text>
          <Pressable
            onPress={() => navigation.navigate(SCREENS.BrowseCourts)}
            className="mt-6 w-full items-center rounded-2xl bg-primary py-3.5"
            accessibilityRole="button"
          >
            <Text className="font-newsreader-bold text-white">Browse courts</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
