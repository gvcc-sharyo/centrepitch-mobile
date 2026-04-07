import React from "react";
import { Pressable, Text } from "react-native";

export function Pill({ label, active, onPress, isDark = true }) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        "mr-2 rounded-full px-4 py-2",
        active ? "bg-primary" : isDark ? "bg-white/10" : "border border-neutral-200 bg-neutral-100",
      ].join(" ")}
    >
      <Text
        className={
          active
            ? "font-newsreader-bold text-xs text-white"
            : isDark
              ? "font-playfair font-semibold text-xs text-white/80"
              : "font-playfair font-semibold text-xs text-neutral-700"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

