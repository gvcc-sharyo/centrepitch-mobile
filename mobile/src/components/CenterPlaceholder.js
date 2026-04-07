import React from "react";
import { Text, View } from "react-native";

export default function CenterPlaceholder({ children }) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-[#1F2B55]">
      <Text className="text-base font-playfair text-neutral-900 dark:text-white">{children}</Text>
    </View>
  );
}

