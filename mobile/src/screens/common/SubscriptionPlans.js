import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeaderBar from "../../components/AppHeaderBar";

export default function SubscriptionPlans() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Subscriptions" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-3">
          <Text className="text-base font-playfair text-neutral-600 dark:text-white/70">
            Subscription plans will appear here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
