import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { PlaceholderImage } from "../PlaceholderImage";
import { getCourtCityStateLine, getSportsAcademyName } from "../../../../utils/courtDisplay";

export function CourtCard({ court, onPress, isDark = true }) {
  const imgSrc = court?.images?.[0]?.url || court?.images?.[0] || null;
  const sportName = typeof court?.sportType === "object" ? court?.sportType?.name : court?.sportType;
  const rating = Number(court?.averageRating || 0);
  const reviewCount = Number(court?.totalReviews || 0);
  const academyName = getSportsAcademyName(court);
  const location = getCourtCityStateLine(court);
  const price = Number(court?.pricing?.hourlyRate || court?.pricePerHour || 0);

  return (
    <Pressable
      onPress={onPress}
      className={
        isDark
          ? "mr-4 w-[260px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 active:opacity-90"
          : "mr-4 w-[260px] overflow-hidden rounded-3xl border border-neutral-200 bg-white active:opacity-90"
      }
    >
      <View className="h-40 w-full overflow-hidden">
        {imgSrc ? (
          <Image source={{ uri: imgSrc }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <PlaceholderImage label="Court" />
        )}
        <View className={isDark ? "absolute inset-0 bg-black/20" : "absolute inset-0 bg-black/10"} />
        {sportName ? (
          <View className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1">
            <Text className="text-[11px] font-bold text-gray-900">{String(sportName)}</Text>
          </View>
        ) : null}
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={isDark ? "flex-1 text-base font-extrabold text-white" : "flex-1 text-base font-extrabold text-neutral-900"}
            numberOfLines={1}
          >
            {court?.name || "Court"}
          </Text>
          {rating > 0 ? (
            <View className="flex-row items-center gap-1">
              <Feather name="star" size={14} color="#fbbf24" />
              <Text className={isDark ? "text-sm font-bold text-white" : "text-sm font-bold text-neutral-900"}>
                {rating.toFixed(1)}
              </Text>
              {reviewCount > 0 ? (
                <Text className={isDark ? "text-xs text-white/60" : "text-xs text-neutral-500"}>({reviewCount})</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {academyName ? (
          <Text className={isDark ? "mt-1 text-xs text-white/70" : "mt-1 text-xs text-neutral-600"} numberOfLines={1}>
            <Text className={isDark ? "text-white/50" : "text-neutral-500"}>Sports academy</Text>{" "}
            <Text className={isDark ? "font-semibold text-white" : "font-semibold text-neutral-900"}>{academyName}</Text>
          </Text>
        ) : null}

        {location ? (
          <View className="mt-2 flex-row items-center gap-2">
            <Feather name="map-pin" size={14} color={isDark ? "rgba(255,255,255,0.7)" : "#6b7280"} />
            <Text className={isDark ? "flex-1 text-xs text-white/70" : "flex-1 text-xs text-neutral-600"} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        {price > 0 ? (
          <Text className="mt-2 text-sm font-extrabold text-emerald-600">
            ₹{price}
            <Text className={isDark ? "text-xs font-normal text-white/60" : "text-xs font-normal text-neutral-500"}>/hr</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

