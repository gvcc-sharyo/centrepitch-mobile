import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { selectTheme } from "../store/slices/uiSlice";

const Tab = createBottomTabNavigator();

function AnimatedTabIcon({ icon, label, focused, activeColor, inactiveColor }) {
  const scale = useRef(new Animated.Value(focused ? 1.08 : 1)).current;
  const lift = useRef(new Animated.Value(focused ? -2 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0.72)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.08 : 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 10,
      }),
      Animated.spring(lift, {
        toValue: focused ? -2 : 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
      Animated.timing(labelOpacity, {
        toValue: focused ? 1 : 0.72,
        duration: focused ? 180 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, lift, labelOpacity, scale]);

  const color = focused ? activeColor : inactiveColor;

  return (
    <View className="items-center justify-center">
      {/* <View
        className="absolute top-0 h-[3px] w-8 rounded-full"
        style={{ backgroundColor: focused ? activeColor : "transparent" }}
      /> */}
      <Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>
        <Feather name={icon} size={24} color={color} />
      </Animated.View>
      {/* <Animated.View style={{ opacity: labelOpacity, marginTop: 3 }}>
        <Text className="text-[11px] font-playfair" style={{ color }}>
          {label}
        </Text>
      </Animated.View> */}
    </View>
  );
}

/**
 * Common dynamic tabs navigator.
 *
 * tabs: [{ name, component, label, icon, options? }]
 */
export default function AppTabs({ tabs, initialRouteName }) {
  const insets = useSafeAreaInsets();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const { tabBarBg, activeColor, inactiveColor, borderColor, shadow } = useMemo(() => {
    if (isDark) {
      return {
        tabBarBg: "#1F2B55",
        activeColor: "#FFFFFF",
        inactiveColor: "rgba(255,255,255,0.65)",
        borderColor: "rgba(255,255,255,0.12)",
        shadow: {
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -6 },
          elevation: 18,
        },
      };
    }
    return {
      tabBarBg: "#FFFFFF",
      activeColor: "#1F2B55",
      inactiveColor: "rgba(17,24,39,0.55)",
      borderColor: "rgba(17,24,39,0.08)",
      shadow: {
        shadowColor: "transparent",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: -6 },
        elevation: 12,
      },
    };
  }, [isDark]);

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName || tabs?.[0]?.name}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: "transparent",
          borderTopWidth: 0,
          height: 50 + Math.max(insets.bottom, 0),
          paddingBottom: Math.max(insets.bottom, 0) + 10,
          paddingTop: 10,
          ...(Platform.OS === "android" ? shadow : shadow),
        },
      }}
    >
      {tabs.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            ...t.options,
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon
                icon={t.icon}
                label={t.label}
                focused={focused}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

