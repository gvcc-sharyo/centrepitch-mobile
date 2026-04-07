import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useDispatch, useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import HeaderBar from "../../components/HeaderBar";
import { selectTheme } from "../../store/slices/uiSlice";
import { googleLogin, register, selectAuthError, selectAuthLoading } from "../../store/slices/authSlice";

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();

  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  /** Android + edge-to-edge: window often does not shrink; pad scroll content by real keyboard height so fields stay reachable. */
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleClientId || undefined,
    iosClientId: googleClientId || undefined,
    androidClientId: googleClientId || undefined,
    webClientId: googleClientId || undefined,
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const auth = response.authentication;
    const accessToken = auth?.accessToken;
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("userinfo");
        const userInfo = await res.json();
        if (cancelled) return;
        dispatch(
          googleLogin({
            googleId: userInfo.sub,
            email: userInfo.email,
            firstName: userInfo.given_name || "",
            lastName: userInfo.family_name || "",
            profilePhoto: userInfo.picture || "",
          })
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, response]);

  const passwordMismatch = useMemo(() => {
    if (!password || !confirmPassword) return false;
    return password !== confirmPassword;
  }, [password, confirmPassword]);

  const scrollBottomPadding = useMemo(() => {
    const base = Math.max(insets.bottom, 16) + 24;
    if (Platform.OS !== "android" || androidKeyboardHeight <= 0) return base;
    return base + androidKeyboardHeight + 56;
  }, [insets.bottom, androidKeyboardHeight]);

  const canSubmit = useMemo(() => {
    const phoneDigits = phone.replace(/\D/g, "");
    return (
      firstName.trim().length >= 2 &&
      lastName.trim().length >= 2 &&
      email.trim().length > 3 &&
      phoneDigits.length >= 8 &&
      password.length >= 6 &&
      confirmPassword.length >= 6 &&
      !passwordMismatch &&
      !isLoading
    );
  }, [firstName, lastName, email, phone, password, confirmPassword, passwordMismatch, isLoading]);

  const onRegister = async () => {
    if (!canSubmit) return;

    const action = await dispatch(
        register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      })
    );

    const payload = action?.payload?.data ?? action?.payload;
    if (payload?.needsVerification) {
      navigation.navigate(SCREENS.VerifyAccount, {
        email: payload.email,
        phone: payload.phone,
      });
      return;
    }

    if (action?.meta?.requestStatus === "fulfilled") {
      navigation.navigate(SCREENS.Dashboard);
    }
  };

  const onGoogleSignup = async () => {
    if (!googleClientId) return;
    await promptAsync();
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: insets.top,
            paddingBottom: scrollBottomPadding,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
        >
          <HeaderBar isDark={isDark} topInset={insets.top} onPressLogo={() => navigation.navigate(SCREENS.OnBoardingScreen)} />

        <View className="px-5 pt-2">
          <Text className="text-3xl font-newsreader-bold text-neutral-900 dark:text-white">Create account</Text>
          <Text className="mt-1.5 text-sm font-playfair text-neutral-600 dark:text-white/70">Join Centre Pitch in under a minute.</Text>

          <View className="mt-5 gap-3">
          <Pressable
            onPress={onGoogleSignup}
            disabled={!request || isLoading}
            accessibilityRole="button"
            className={[
              "h-12 flex-row items-center justify-center gap-2.5 rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5",
              !request || isLoading ? "opacity-60" : "opacity-100",
            ].join(" ")}
          >
            <Feather name="chrome" size={18} color={isDark ? "#F9FAFB" : "#111827"} />
            <Text className="text-base font-playfair font-semibold text-neutral-900 dark:text-white">Sign up with Google</Text>
          </Pressable>

          <View className="my-2 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
            <Text className="text-xs text-neutral-500 dark:text-white/50">or sign up with email</Text>
            <View className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              First Name <Text className="text-red-500">*</Text>
            </Text>
            <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
              <Feather name="user" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                autoCapitalize="words"
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="next"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              Last Name <Text className="text-red-500">*</Text>
            </Text>
            <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
              <Feather name="user" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                autoCapitalize="words"
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="next"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              Email Address <Text className="text-red-500">*</Text>
            </Text>
            <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
              <Feather name="mail" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="next"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              Phone <Text className="text-red-500">*</Text>
            </Text>
            <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
              <Feather name="phone" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                keyboardType="phone-pad"
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="next"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              Password <Text className="text-red-500">*</Text>
            </Text>
            <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
              <Feather name="lock" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="next"
              />
              <Pressable
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                className="p-1.5"
              >
                <Feather name={passwordVisible ? "eye-off" : "eye"} size={18} color={isDark ? "rgba(249,250,251,0.8)" : "rgba(17,24,39,0.7)"} />
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
              Confirm Password <Text className="text-red-500">*</Text>
            </Text>
            <View
              className={[
                "h-12 flex-row items-center gap-3 rounded-2xl border bg-white px-4 dark:bg-white/5",
                passwordMismatch ? "border-red-500" : "border-neutral-200 dark:border-white/10",
              ].join(" ")}
            >
              <Feather name="lock" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-base text-neutral-900 dark:text-white"
                returnKeyType="done"
                onSubmitEditing={onRegister}
              />
            </View>
          </View>

          {passwordMismatch ? <Text className="text-sm text-red-500">Passwords do not match</Text> : null}

          {typeof error === "string" && error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <Pressable
            onPress={onRegister}
            disabled={!canSubmit}
            accessibilityRole="button"
            className={[
              "mt-1 h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary",
              canSubmit ? "opacity-100" : "opacity-55",
            ].join(" ")}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Feather name="user-plus" size={18} color="#fff" />}
            <Text className="text-base font-newsreader-bold text-white">Create account</Text>
          </Pressable>

          <View className="mt-2 flex-row flex-wrap items-center justify-center gap-1">
            <Text className="text-sm font-playfair text-neutral-600 dark:text-white/70">Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate(SCREENS.Login)} accessibilityRole="button" className="py-2">
              <Text className="text-sm font-newsreader-bold text-primary">Sign in</Text>
            </Pressable>
          </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
