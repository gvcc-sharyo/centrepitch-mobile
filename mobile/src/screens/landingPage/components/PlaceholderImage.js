import React from "react";
import { Text, View } from "react-native";

export function PlaceholderImage({ label }) {
  return (
    <View className="h-full w-full items-center justify-center bg-white/10">
      <Text className="text-xs font-semibold text-white/60">{label}</Text>
    </View>
  );
}

