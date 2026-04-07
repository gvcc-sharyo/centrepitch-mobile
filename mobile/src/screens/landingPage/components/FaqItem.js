import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

export function FaqItem({ q, a, isDark = true }) {
  const [open, setOpen] = useState(false);
  return (
    <View
      className={
        isDark ? "overflow-hidden rounded-2xl border border-white/10 bg-white/5" : "overflow-hidden rounded-2xl border border-neutral-200 bg-white"
      }
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between gap-3 px-4 py-4"
      >
        <Text className={isDark ? "flex-1 text-sm font-bold text-white" : "flex-1 text-sm font-bold text-neutral-900"} numberOfLines={2}>
          {q}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={isDark ? "rgba(255,255,255,0.8)" : "#374151"}
        />
      </Pressable>
      {open ? (
        <View className="px-4 pb-4">
          <Text className={isDark ? "text-sm leading-6 text-white/70" : "text-sm leading-6 text-neutral-600"}>{a}</Text>
        </View>
      ) : null}
    </View>
  );
}

