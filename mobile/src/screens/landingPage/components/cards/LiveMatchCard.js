import React from "react";
import { Pressable, Text, View } from "react-native";

import { LivePill } from "../live/LivePill";

export function LiveMatchCard({ match, onPress, isDark = true }) {
  return (
    <Pressable
      onPress={onPress}
      className={
        isDark
          ? "mr-4 w-[260px] rounded-3xl border border-white/10 bg-white/5 p-4 active:opacity-90"
          : "mr-4 w-[260px] rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm active:opacity-90"
      }
    >
      <View className="flex-row items-center justify-between gap-3">
        <LivePill label={match?.level || "Live"} />
        <Text className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-neutral-900"}>{match?.fee || ""}</Text>
      </View>
      <Text className={isDark ? "mt-3 text-lg font-extrabold text-white" : "mt-3 text-lg font-extrabold text-neutral-900"} numberOfLines={2}>
        {match?.title || "Live match"}
      </Text>
      <Text className={isDark ? "mt-2 text-xs text-white/60" : "mt-2 text-xs text-neutral-600"}>{match?.timeLabel || "Live now"}</Text>
      <Text className={isDark ? "mt-1 text-xs text-white/60" : "mt-1 text-xs text-neutral-600"}>{match?.joined || ""}</Text>
      <View className="mt-4 items-center justify-center rounded-full bg-primary py-2.5">
        <Text className="text-sm font-bold text-white">Join Match</Text>
      </View>
    </Pressable>
  );
}

