import "./global.css";
import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Animated, Easing, Image, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store, persistor } from "./src/store/store";
import AppNavigator from "./src/navigation/AppNavigator";
import { useFonts as useNewsreaderFonts, Newsreader_400Regular, Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import { useFonts as usePlayfairFonts, PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/** Must not run during render — patches React Native Text/TextInput and can trigger React 19 warnings if done in render. */
function applyGlobalFontDefaults() {
  const pickFont = (style) => {
    const flat = StyleSheet.flatten(style) || {};
    if (flat.fontFamily) return null;
    const w = String(flat.fontWeight || "").trim();
    const n = Number.parseInt(w, 10);
    if (!Number.isNaN(n)) {
      if (n >= 700) return "Newsreader_700Bold";
      if (n >= 600) return "Newsreader_600SemiBold";
    }
    // Body / descriptions: Playfair (matches frontend)
    return "PlayfairDisplay_400Regular";
  };

  if (!Text.__cp_patched) {
    const oldRender = Text.render;
    Text.render = function render(...args) {
      const origin = oldRender.call(this, ...args);
      const fontFamily = pickFont(origin?.props?.style);
      if (!fontFamily) return origin;
      return React.cloneElement(origin, {
        style: [{ fontFamily }, origin.props.style],
      });
    };
    Text.__cp_patched = true;
  }

  if (!TextInput.__cp_patched) {
    const oldRender = TextInput.render;
    if (typeof oldRender === "function") {
      TextInput.render = function render(...args) {
        const origin = oldRender.call(this, ...args);
        const fontFamily = pickFont(origin?.props?.style);
        if (!fontFamily) return origin;
        return React.cloneElement(origin, {
          style: [{ fontFamily }, origin.props.style],
        });
      };
    }
    TextInput.__cp_patched = true;
  }
}

const SPLASH_TOTAL_MS = 5000;
const SPLASH_HOLD_START_MS = 2000; // 0s – 2s: solid #1F2B55 + white logo
const SPLASH_WIPE_MS = 2000; // 2s – 4s: radial gradient wipe toward centre
const SPLASH_HOLD_END_MS = 1000; // 4s – 5s: #ffffff + cp-logo.png
const SPLASH_START_BG = "#1F2B55";
const SPLASH_END_BG = "#ffffff";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState("start"); // 'start' | 'wipe' | 'end'
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [, setFontPatchGeneration] = useState(0);

  const [newsreaderLoaded] = useNewsreaderFonts({
    Newsreader_400Regular,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
  });
  const [playfairLoaded] = usePlayfairFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useLayoutEffect(() => {
    if (!newsreaderLoaded || !playfairLoaded) return;
    applyGlobalFontDefaults();
    setFontPatchGeneration((g) => g + 1);
  }, [newsreaderLoaded, playfairLoaded]);

  useEffect(() => {
    if (!newsreaderLoaded || !playfairLoaded) return;

    setShowSplash(true);
    setSplashPhase("start");
    progress.setValue(0);

    const startWipeTimeout = setTimeout(() => {
      setSplashPhase("wipe");
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: SPLASH_WIPE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, SPLASH_HOLD_START_MS);

    const endPhaseTimeout = setTimeout(() => {
      setSplashPhase("end");
    }, SPLASH_HOLD_START_MS + SPLASH_WIPE_MS);

    const hideTimeout = setTimeout(() => setShowSplash(false), SPLASH_TOTAL_MS);

    return () => {
      clearTimeout(startWipeTimeout);
      clearTimeout(endPhaseTimeout);
      clearTimeout(hideTimeout);
    };
  }, [newsreaderLoaded, playfairLoaded, progress]);

  const maxRadius = Math.ceil(Math.sqrt(width * width + height * height) / 2);
  const circleSize = maxRadius * 2;
  const circleLeft = width / 2 - maxRadius;
  const circleTop = height / 2 - maxRadius;
  const radialGradientId = useMemo(() => `splashRadialWipe-${circleSize}`, [circleSize]);

  if (!newsreaderLoaded || !playfairLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#1F2B55" }} />;
  }

  // Radial gradient disk: dark centre → white edge; scale 1→0 so colour resolves toward centre.
  const wipeStyle = {
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        }),
      },
    ],
  };

  const whiteLogoStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
  };

  const colorLogoStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <PersistGate loading={<View style={{ flex: 1, backgroundColor: "#1F2B55" }} />} persistor={persistor}>
            <View style={{ flex: 1 }}>
              <AppNavigator />
              {showSplash ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: splashPhase === "start" ? SPLASH_START_BG : SPLASH_END_BG,
                  }}
                >
                  {splashPhase === "wipe" ? (
                    <Animated.View
                      style={[
                        {
                          position: "absolute",
                          left: circleLeft,
                          top: circleTop,
                          width: circleSize,
                          height: circleSize,
                        },
                        wipeStyle,
                      ]}
                      pointerEvents="none"
                      collapsable={false}
                    >
                      {/*
                        2–4s: radial gradient on a full disk (not a flat View fill).
                        Scale 1→0 pulls the gradient toward the centre over white.
                      */}
                      <Svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
                        <Defs>
                          <RadialGradient id={radialGradientId} cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={SPLASH_START_BG} stopOpacity="1" />
                            <Stop offset="35%" stopColor={SPLASH_START_BG} stopOpacity="0.95" />
                            <Stop offset="55%" stopColor={SPLASH_START_BG} stopOpacity="0.55" />
                            <Stop offset="78%" stopColor={SPLASH_END_BG} stopOpacity="0.55" />
                            <Stop offset="100%" stopColor={SPLASH_END_BG} stopOpacity="1" />
                          </RadialGradient>
                        </Defs>
                        <Circle cx={maxRadius} cy={maxRadius} r={maxRadius} fill={`url(#${radialGradientId})`} />
                      </Svg>
                    </Animated.View>
                  ) : null}
                  {splashPhase === "wipe" ? (
                    <View style={{ width: 220, height: 220 }}>
                      <Animated.Image
                        source={require("./assets/public/cp-white-logo.png")}
                        style={[{ width: 220, height: 220, position: "absolute", top: 0, left: 0 }, whiteLogoStyle]}
                        resizeMode="contain"
                      />
                      <Animated.Image
                        source={require("./assets/public/cp-logo.png")}
                        style={[{ width: 220, height: 220, position: "absolute", top: 0, left: 0 }, colorLogoStyle]}
                        resizeMode="contain"
                      />
                    </View>
                  ) : (
                    <Image
                      source={
                        splashPhase === "end"
                          ? require("./assets/public/cp-logo.png")
                          : require("./assets/public/cp-white-logo.png")
                      }
                      style={{ width: 220, height: 220 }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              ) : null}
            </View>
          </PersistGate>
        </Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}