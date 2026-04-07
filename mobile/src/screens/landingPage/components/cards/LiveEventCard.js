import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { PlaceholderImage } from "../PlaceholderImage";
import { LivePill } from "../live/LivePill";

export function LiveEventCard({ event, onPress, isDark = true }) {
  const banner = event?.bannerImages?.[0] || event?.bannerImages || null;
  const locationLabel = [event?.location?.city, event?.location?.country]
    .filter(Boolean)
    .join(", ");
  const fee = Number(event?.registrationFee || 0) > 0 ? `₹${event.registrationFee}` : "Free";

  const participationLabel =
    event?.gameFormat === "team"
      ? `${event?.registeredTeams?.length || 0} teams`
      : `${event?.registeredPlayers?.length || 0} players`;

  return (
    <Pressable
      onPress={onPress}
      className={
        isDark
          ? "mr-4 w-[280px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 active:opacity-90"
          : "mr-4 w-[280px] overflow-hidden rounded-3xl border border-neutral-200 bg-white active:opacity-90"
      }
    >
      <View className="h-36 w-full">
        {banner ? (
          <Image source={{ uri: banner }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <PlaceholderImage label="Event" />
        )}
        <View className="absolute right-3 top-3">
          <LivePill label="Live" />
        </View>
      </View>
      <View className="p-4">
        <Text className={isDark ? "text-base font-extrabold text-white" : "text-base font-extrabold text-neutral-900"} numberOfLines={1}>
          {event?.name || "Live event"}
        </Text>
        <Text className={isDark ? "mt-1 text-xs text-white/60" : "mt-1 text-xs text-neutral-600"} numberOfLines={1}>
          {locationLabel || "Location to be announced"}
        </Text>
        <View
          className={
            isDark
              ? "mt-3 flex-row items-center justify-between border-t border-white/10 pt-3"
              : "mt-3 flex-row items-center justify-between border-t border-neutral-200 pt-3"
          }
        >
          <Text className="text-sm font-extrabold text-primary-400">{fee}</Text>
          <Text className={isDark ? "text-xs font-semibold uppercase tracking-wider text-white/60" : "text-xs font-semibold uppercase tracking-wider text-neutral-500"}>
            {participationLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

