import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToToasts } from "../utils/toast";

const TYPE_STYLES = {
  success: { bg: "bg-emerald-600", text: "text-white" },
  error: { bg: "bg-red-600", text: "text-white" },
  loading: { bg: "bg-neutral-900", text: "text-white" },
  info: { bg: "bg-primary", text: "text-white" },
};

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toastState, setToastState] = useState(null); // { type, message }
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  const hideTimer = useRef(null);

  const top = useMemo(() => Math.max(insets.top, 10) + 8, [insets.top]);

  useEffect(() => {
    const unsub = subscribeToToasts((evt) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      if (evt.type === "dismiss") {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -8, duration: 160, useNativeDriver: true }),
        ]).start(() => setToastState(null));
        return;
      }

      if (!evt.message) return;
      setToastState({ type: evt.type, message: evt.message });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      // Auto-hide (keep loading visible until dismiss)
      const shouldAutoHide = evt.type !== "loading";
      if (shouldAutoHide) {
        hideTimer.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -8, duration: 180, useNativeDriver: true }),
          ]).start(() => setToastState(null));
        }, 2600);
      }
    });

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      unsub();
    };
  }, [opacity, translateY]);

  if (!toastState) return null;

  const style = TYPE_STYLES[toastState.type] || TYPE_STYLES.info;
  const shadow = Platform.OS === "android" ? "shadow-none" : "shadow-xl";

  return (
    <View pointerEvents="none" className="absolute left-0 right-0 z-50">
      <Animated.View
        style={{ opacity, transform: [{ translateY }], marginTop: top }}
        className="px-4"
      >
        <View className={[style.bg, shadow, "rounded-2xl px-4 py-3"].join(" ")}>
          <Text className={[style.text, "text-sm font-playfair"].join(" ")}>
            {toastState.message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

