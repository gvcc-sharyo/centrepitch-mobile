import React from "react";
import { Text, View } from "react-native";

export function LivePill({ label }) {
  return (
    <View className="flex-row items-center gap-2 rounded-full bg-red-500/20 px-3 py-1">
      <View className="h-2 w-2 rounded-full bg-red-500" />
      <Text className="text-[11px] font-extrabold uppercase tracking-wider text-red-200">
        {label}
      </Text>
    </View>
  );
}

