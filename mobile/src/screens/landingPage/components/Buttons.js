import React from "react";
import { Pressable, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { primary } from "../../../theme/tokens";

export function PrimaryButton({ title, icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary active:bg-primary-600"
    >
      {icon ? <Feather name={icon} size={18} color="#fff" /> : null}
      <Text className="font-playfair font-semibold text-base text-white">{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-white active:bg-primary/10"
    >
      {icon ? <Feather name={icon} size={18} color={primary.DEFAULT} /> : null}
      <Text className="font-playfair font-semibold text-base text-primary">{title}</Text>
    </Pressable>
  );
}

