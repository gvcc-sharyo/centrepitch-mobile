import React from "react";
import { Text, View } from "react-native";

export default function SectionDivider({ text }) {
  return (
    <View className="auth-divider">
      <View className="auth-divider-line" />
      <Text className="auth-divider-text">{text}</Text>
      <View className="auth-divider-line" />
    </View>
  );
}

