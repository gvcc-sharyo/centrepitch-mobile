import React from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

export function SectionHeader({ title, subtitle, onPressMore, moreLabel = "See all", isDark = true }) {
  return (
    <View className="mb-4 flex-row items-end justify-between gap-4">
      <View className="flex-1">
        <Text className={isDark ? "font-newsreader-bold text-lg text-white" : "font-newsreader-bold text-lg text-neutral-900"}>
          {title}
        </Text>
        {subtitle ? (
          <Text className={isDark ? "font-playfair mt-1 text-sm text-white/70" : "font-playfair mt-1 text-sm text-neutral-600"}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPressMore ? (
        <Pressable
          onPress={onPressMore}
          className={
            isDark
              ? "flex-row items-center gap-2 rounded-full bg-white/10 px-3 py-2"
              : "flex-row items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2"
          }
        >
          <Text
            className={
              isDark ? "font-playfair font-semibold text-xs text-white/80" : "font-playfair font-semibold text-xs text-neutral-800"
            }
          >
            {moreLabel}
          </Text>
          <Feather name="arrow-right" size={14} color={isDark ? "rgba(255,255,255,0.8)" : "#374151"} />
        </Pressable>
      ) : null}
    </View>
  );
}

