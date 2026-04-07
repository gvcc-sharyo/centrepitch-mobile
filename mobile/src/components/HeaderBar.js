import React from "react";
import { Image, Pressable, View } from "react-native";

import Logo from "../../assets/public/cp-logo.png";
import WhiteLogo from "../../assets/public/cp-white-logo.png";

export default function HeaderBar({ isDark, topInset = 0, onPressLogo }) {
  return (
    <View
      className="px-4 pb-10 pt-10 flex-row items-center justify-between"
    >
      <Pressable
        onPress={onPressLogo}
        disabled={!onPressLogo}
        accessibilityRole={onPressLogo ? "button" : undefined}
        accessibilityLabel={onPressLogo ? "Go to onboarding" : undefined}
        className="h-11 w-[120px] justify-center"
      >
        <Image source={isDark ? WhiteLogo : Logo} resizeMode="contain" className="w-24 h-10" />
      </Pressable>
    </View>
  );
}
