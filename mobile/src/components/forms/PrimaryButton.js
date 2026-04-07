import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

export default function PrimaryButton({ title, icon, isLoading, disabled, onPress }) {
  const canPress = !disabled && !isLoading;
  return (
    <Pressable
      onPress={onPress}
      disabled={!canPress}
      accessibilityRole="button"
      className={["auth-primary-btn", canPress ? "opacity-100" : "opacity-55"].join(" ")}
    >
      {isLoading ? <ActivityIndicator color="#fff" /> : icon}
      <Text className="auth-primary-btn-text">{title}</Text>
    </Pressable>
  );
}

