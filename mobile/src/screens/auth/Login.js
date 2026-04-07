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
import authService from "../../services/authService";
import { toast } from "../../utils/toast";
import {
  clearVerificationState,
  googleLogin,
  selectAuthError,
  selectAuthLoading,
  selectNeedsEmailVerification,
  selectVerificationEmail,
  verifyMobileEmailOtp,
} from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import HeaderBar from "../../components/HeaderBar";

WebBrowser.maybeCompleteAuthSession();

export default function Login({ navigation }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();

  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const needsEmailVerification = useSelector(selectNeedsEmailVerification);
  const verificationEmail = useSelector(selectVerificationEmail);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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
    if (!accessToken) {
      toast.error("Google sign-in did not return an access token.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("userinfo");
        const userInfo = await res.json();
        if (cancelled) return;
        const resultAction = await dispatch(
          googleLogin({
            googleId: userInfo.sub,
            email: userInfo.email,
            firstName: userInfo.given_name || "",
            lastName: userInfo.family_name || "",
            profilePhoto: userInfo.picture || "",
          })
        );
        if (googleLogin.fulfilled.match(resultAction)) {
          toast.success("Signed in with Google.");
        } else if (googleLogin.rejected.match(resultAction)) {
          toast.error(typeof resultAction.payload === "string" ? resultAction.payload : "Google sign-in failed.");
        }
      } catch {
        if (!cancelled) toast.error("Could not load Google profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, response]);

  useEffect(() => {
    if (!needsEmailVerification || !verificationEmail) return;
    navigation.navigate(SCREENS.VerifyAccount, {
      email: verificationEmail,
    });
  }, [needsEmailVerification, navigation, verificationEmail]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSendCode = useMemo(() => {
    const t = email.trim();
    return t.length > 3 && t.includes("@") && !isLoading;
  }, [email, isLoading]);

  const canVerifyOtp = useMemo(() => {
    return otp.trim().length >= 4 && normalizedEmail.length > 3 && !isLoading;
  }, [otp, normalizedEmail, isLoading]);

  const onSendCode = async () => {
    if (!canSendCode) return;
    try {
      toast.loading("Sending code...");
      await authService.requestMobileEmailOtp(normalizedEmail);
      toast.dismiss();
      toast.success("Check your email for the code.");
      setOtpSent(true);
      setOtp("");
    } catch (e) {
      const message = e?.response?.data?.message || "Failed to send code.";
      toast.dismiss();
      toast.error(message);
    }
  };

  const onVerifyOtp = () => {
    if (!canVerifyOtp) return;
    dispatch(verifyMobileEmailOtp({ email: normalizedEmail, otp: otp.trim() })).then((result) => {
      if (verifyMobileEmailOtp.fulfilled.match(result)) {
        toast.success("You're signed in.");
        return;
      }
      if (verifyMobileEmailOtp.rejected.match(result)) {
        toast.error(result.payload || "Invalid code.");
      }
    });
  };

  const onGoogleLogin = async () => {
    if (!googleClientId) {
      toast.error("Google sign-in is not configured (missing client ID).");
      return;
    }
    await promptAsync();
  };

  const scrollBottomPadding = useMemo(() => {
    const base = Math.max(insets.bottom, 16) + 24;
    if (Platform.OS !== "android" || androidKeyboardHeight <= 0) return base;
    return base + androidKeyboardHeight + 56;
  }, [insets.bottom, androidKeyboardHeight]);

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
          <HeaderBar
            isDark={isDark}
            topInset={insets.top}
            onPressLogo={() => navigation.navigate(SCREENS.OnBoardingScreen)}
          />

          <View className="px-5 pt-2">
            <Text className="text-3xl font-newsreader-bold text-neutral-900 dark:text-white text-center">
              Welcome
            </Text>
            <Text className="mt-1.5 text-sm font-playfair text-neutral-600 dark:text-white/70 text-center">
              Sign in with Google, or enter your email for a one-time code. New accounts are created automatically.
            </Text>

            <View className="mt-5 gap-3">
              <Pressable
                onPress={onGoogleLogin}
                disabled={!request || isLoading}
                accessibilityRole="button"
                className={[
                  "h-12 flex-row items-center justify-center gap-2.5 rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5",
                  !request || isLoading ? "opacity-60" : "opacity-100",
                ].join(" ")}
              >
                <Feather name="chrome" size={18} color={isDark ? "#F9FAFB" : "#111827"} />
                <Text className="text-base font-playfair font-semibold text-neutral-900 dark:text-white">
                  Continue with Google
                </Text>
              </Pressable>

              <View className="my-2 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
                <Text className="text-xs text-neutral-500 dark:text-white/50">or use email</Text>
                <View className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
                  Email <Text className="text-red-500">*</Text>
                </Text>
                <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                  <Feather name="mail" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      dispatch(clearVerificationState());
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!otpSent}
                    className="flex-1 text-base text-neutral-900 dark:text-white"
                  />
                </View>
              </View>

              {otpSent ? (
                <View className="gap-2">
                  <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
                    One-time code
                  </Text>
                  <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                    <Feather name="shield" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                      keyboardType="number-pad"
                      maxLength={8}
                      className="flex-1 text-base text-neutral-900 dark:text-white"
                      returnKeyType="done"
                      onSubmitEditing={onVerifyOtp}
                    />
                  </View>
                </View>
              ) : null}

              {typeof error === "string" && error ? <Text className="text-sm text-red-500">{error}</Text> : null}

              {!otpSent ? (
                <Pressable
                  onPress={onSendCode}
                  disabled={!canSendCode}
                  accessibilityRole="button"
                  className={[
                    "mt-1 h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary",
                    canSendCode ? "opacity-100" : "opacity-55",
                  ].join(" ")}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Feather name="mail" size={18} color="#fff" />}
                  <Text className="text-base font-newsreader-bold text-white">Send code</Text>
                </Pressable>
              ) : (
                <View className="mt-1 gap-2">
                  <Pressable
                    onPress={onVerifyOtp}
                    disabled={!canVerifyOtp}
                    accessibilityRole="button"
                    className={[
                      "h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary",
                      canVerifyOtp ? "opacity-100" : "opacity-55",
                    ].join(" ")}
                  >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Feather name="check" size={18} color="#fff" />}
                    <Text className="text-base font-newsreader-bold text-white">Verify & sign in</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setOtpSent(false);
                      setOtp("");
                    }}
                    accessibilityRole="button"
                    className="items-center py-2"
                  >
                    <Text className="text-sm font-playfair font-semibold text-primary">Change email</Text>
                  </Pressable>
                  <Pressable onPress={onSendCode} disabled={!canSendCode} accessibilityRole="button" className="items-center py-1">
                    <Text className="text-sm font-playfair text-neutral-600 dark:text-white/70">Resend code</Text>
                  </Pressable>
                </View>
              )}

              {/* <View className="mt-4 items-center gap-2">
                <Pressable
                  onPress={() => navigation.navigate(SCREENS.PasswordLogin)}
                  accessibilityRole="button"
                  className="py-2"
                >
                  <Text className="text-sm font-playfair font-semibold text-primary">Sign in with password instead</Text>
                </Pressable>
              </View> */}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
