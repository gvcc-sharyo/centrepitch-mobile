import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import { selectTheme } from "../../store/slices/uiSlice";

export default function LabeledIconInput({
  label,
  required = false,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  secureTextEntry,
  onSubmitEditing,
  returnKeyType,
  rightSlot,
  error,
}) {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  return (
    <View className="auth-field">
      <Text className="auth-label">
        {label}
        {required ? " *" : ""}
      </Text>

      <View className={["auth-input-row", error ? "border-red-500" : ""].join(" ")}>
        {icon ? <Feather name={icon} size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} /> : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          className="auth-input"
        />

        {typeof rightSlot === "function" ? rightSlot({ isDark }) : rightSlot}
      </View>

      {typeof error === "string" && error ? <Text className="text-sm font-playfair text-red-500">{error}</Text> : null}
    </View>
  );
}

