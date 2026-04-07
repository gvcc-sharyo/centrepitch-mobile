import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { PlaceholderImage } from "../PlaceholderImage";

export function PersonCard({ title, subtitle, imageUri, onPress, isDark = true }) {
  return (
    <Pressable
      onPress={onPress}
      className={
        isDark
          ? "mr-4 w-[170px] items-center rounded-3xl border border-white/10 bg-white/5 p-4 active:opacity-90"
          : "mr-4 w-[170px] items-center rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm active:opacity-90"
      }
    >
      <View
        className={
          isDark
            ? "h-24 w-24 overflow-hidden rounded-full border-2 border-white/20 bg-white/10"
            : "h-24 w-24 overflow-hidden rounded-full border-2 border-neutral-200 bg-neutral-100"
        }
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <PlaceholderImage label="Photo" />
        )}
      </View>
      <Text
        className={isDark ? "mt-3 text-center text-sm font-extrabold text-white" : "mt-3 text-center text-sm font-extrabold text-neutral-900"}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          className={
            isDark
              ? "mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-white/60"
              : "mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
          }
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

