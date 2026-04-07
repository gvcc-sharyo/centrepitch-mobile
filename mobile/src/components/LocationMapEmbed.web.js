import React from "react";
import { Text, View } from "react-native";

/** react-native-maps is not used on web; manual coordinates still work in the modal. */
export default function LocationMapEmbed() {
  return (
    <View className="h-[220px] items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-white/15 dark:bg-white/5">
      <Text className="px-4 text-center text-sm font-playfair text-neutral-600 dark:text-white/70">
        Map picker runs on iOS and Android. Enter your area below or use “Use current location” on a device.
      </Text>
    </View>
  );
}
