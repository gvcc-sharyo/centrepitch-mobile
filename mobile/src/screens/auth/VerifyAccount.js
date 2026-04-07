import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import HeaderBar from "../../components/HeaderBar";
import { SCREENS } from "../../constants/navigation";
import authService from "../../services/authService";
import { toast } from "../../utils/toast";
import {
  clearVerificationState,
  getMe,
  logout,
  selectEmailVerified,
  selectIsAuthenticated,
  selectNeedsEmailVerification,
  selectUser,
  selectVerificationEmail,
  selectVerificationPhone,
  verifyOTP,
  verifyPhoneOTP,
} from "../../store/slices/authSlice";
import { selectPhoneVerified } from "../../store/selectors/authSelectors";
import { selectTheme } from "../../store/slices/uiSlice";

export default function VerifyAccount() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const needsEmailVerification = useSelector(selectNeedsEmailVerification);
  const verificationEmail = useSelector(selectVerificationEmail);
  const verificationPhone = useSelector(selectVerificationPhone);
  const emailVerified = useSelector(selectEmailVerified);
  const phoneVerified = useSelector(selectPhoneVerified);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  const fromProfile = route.params?.fromProfile === true;
  const paramEmail = route.params?.email;
  const paramPhone = route.params?.phone;

  const email = useMemo(
    () => String(paramEmail || verificationEmail || user?.email || "").trim(),
    [paramEmail, verificationEmail, user?.email]
  );
  const phone = useMemo(
    () => String(paramPhone || verificationPhone || user?.phone || "").trim(),
    [paramPhone, verificationPhone, user?.phone]
  );

  const [otpValue, setOtpValue] = useState("");
  const [phoneOtpValue, setPhoneOtpValue] = useState("");
  const [submittingEmailOtp, setSubmittingEmailOtp] = useState(false);
  const [submittingPhoneOtp, setSubmittingPhoneOtp] = useState(false);

  const verificationGuidance = useMemo(() => {
    if (!emailVerified) return "Enter the 6-digit code we sent to your email.";
    if (!phoneVerified && phone)
      return "Your email is verified. Phone verification is optional — enter the code sent to your phone.";
    return "Your account is verified.";
  }, [emailVerified, phoneVerified, phone]);

  const canShowVerification = Boolean(email) && (needsEmailVerification || fromProfile || paramEmail);

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(SCREENS.Login);
  };

  /** Pop verify flow and open the Profile tab (main stack → RoleRoot → tabs). */
  const navigateToProfileScreen = () => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "RoleRoot",
        params: { screen: SCREENS.Profile },
      })
    );
  };

  const handleVerifyOTP = async () => {
    const otp = otpValue.trim();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code.");
      return;
    }
    setSubmittingEmailOtp(true);
    try {
      const result = await dispatch(verifyOTP({ email, otp }));
      if (verifyOTP.fulfilled.match(result)) {
        const payload = result.payload?.data ?? result.payload;
        await dispatch(getMe());
        const phoneOptionalNext = payload?.needsVerification || payload?.needsPhoneVerification;
        if (phoneOptionalNext) {
          toast.success("Email verified. You can verify your phone later from Profile if you like.");
          setOtpValue("");
        } else {
          toast.success("Email verified.");
        }
        if (fromProfile) {
          navigateToProfileScreen();
        }
        return;
      }
      if (verifyOTP.rejected.match(result)) {
        toast.error(typeof result.payload === "string" ? result.payload : "Invalid or expired code.");
      }
    } finally {
      setSubmittingEmailOtp(false);
    }
  };

  const handleVerifyPhoneOTP = async () => {
    const otp = phoneOtpValue.trim();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit phone code.");
      return;
    }
    if (!phone) {
      toast.error("No phone number on file.");
      return;
    }
    setSubmittingPhoneOtp(true);
    try {
      const result = await dispatch(verifyPhoneOTP({ email, phone, otp }));
      if (verifyPhoneOTP.fulfilled.match(result)) {
        const payload = result.payload?.data ?? result.payload;
        await dispatch(getMe());
        if (payload?.needsVerification || payload?.needsEmailVerification) {
          toast.success("Phone verified.");
          setPhoneOtpValue("");
          return;
        }
        toast.success("Phone verified.");
        if (fromProfile) {
          navigateToProfileScreen();
        }
        return;
      }
      if (verifyPhoneOTP.rejected.match(result)) {
        toast.error(typeof result.payload === "string" ? result.payload : "Invalid or expired code.");
      }
    } finally {
      setSubmittingPhoneOtp(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      toast.loading("Sending code...");
      await authService.sendOTP(email);
      toast.dismiss();
      toast.success("New code sent to your email.");
      setOtpValue("");
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to resend code.");
    }
  };

  const handleResendPhoneOTP = async () => {
    try {
      toast.loading("Sending code...");
      await authService.sendPhoneOTP({ email, phone });
      toast.dismiss();
      toast.success("New code sent to your phone.");
      setPhoneOtpValue("");
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to resend phone code.");
    }
  };

  const handleSkipForNow = () => {
    if (fromProfile) {
      navigateToProfileScreen();
      return;
    }
    dispatch(clearVerificationState());
    toast.success("You can verify later from your profile.");
    navigation.navigate(SCREENS.Login);
  };

  const handleUseDifferentEmail = () => {
    dispatch(clearVerificationState());
    dispatch(logout());
    navigation.navigate(SCREENS.Login);
  };

  const showPhoneVerificationStep = emailVerified && !phoneVerified && Boolean(phone);

  if (!canShowVerification) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 24),
            paddingHorizontal: 20,
          }}
        >
          <Text className="text-center text-xl font-newsreader-bold text-neutral-900 dark:text-white">
            No pending verification
          </Text>
          <Text className="mt-2 text-center text-sm font-playfair text-neutral-600 dark:text-white/70">
            Open this screen from your profile after requesting a code, or sign in to continue.
          </Text>
          <Pressable
            onPress={() => (isAuthenticated ? onBack() : navigation.navigate(SCREENS.Login))}
            className="mt-6 h-12 items-center justify-center rounded-2xl bg-primary"
          >
            <Text className="text-base font-newsreader-bold text-white">{isAuthenticated ? "Go back" : "Go to sign in"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

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
            paddingBottom: Math.max(insets.bottom, 28) + 56,
            paddingLeft: Math.max(insets.left, 20),
            paddingRight: Math.max(insets.right, 20),
            maxWidth: 480,
            width: "100%",
            alignSelf: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <HeaderBar
            isDark={isDark}
            topInset={0}
            onPressLogo={fromProfile ? onBack : undefined}
          />

          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="mb-2 mt-1 flex-row items-center gap-2 self-start py-2"
          >
            <Feather name="arrow-left" size={22} color={isDark ? "#F9FAFB" : "#111827"} />
            <Text className="text-base font-playfair font-semibold text-neutral-900 dark:text-white">Back</Text>
          </Pressable>

          <View className="mb-6 h-14 w-14 items-center justify-center self-center rounded-full bg-emerald-500/15 dark:bg-emerald-500/20">
            <Feather name="shield" size={28} color={isDark ? "#6EE7B7" : "#059669"} />
          </View>

          <Text className="text-center text-2xl font-newsreader-bold text-neutral-900 dark:text-white">
            Complete verification
          </Text>
          <Text className="mt-2 px-1 text-center text-[15px] leading-[22px] font-playfair text-neutral-600 dark:text-white/70">
            {verificationGuidance}
          </Text>

          <View
            className="mt-8 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
            style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 }}
          >
            {!emailVerified ? (
              <View className="w-full gap-5">
                <View className="w-full">
                  <Text className="text-sm leading-5 font-playfair text-neutral-700 dark:text-white/80">
                    Email code sent to
                  </Text>
                  <Text
                    className="mt-1 text-sm font-playfair font-semibold leading-5 text-neutral-900 dark:text-white"
                    numberOfLines={3}
                  >
                    {email}
                  </Text>
                </View>
                <View className="w-full gap-2">
                  <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/90">
                    Email verification code
                  </Text>
                  <TextInput
                    value={otpValue}
                    onChangeText={(t) => setOtpValue(t.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.35)" : "rgba(17,24,39,0.35)"}
                    keyboardType="number-pad"
                    maxLength={6}
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    autoFocus
                  />
                </View>
                <Pressable
                  onPress={handleVerifyOTP}
                  disabled={submittingEmailOtp || otpValue.length !== 6}
                  className={[
                    "min-h-[48px] w-full flex-row items-center justify-center rounded-2xl bg-primary px-4",
                    submittingEmailOtp || otpValue.length !== 6 ? "opacity-50" : "opacity-100",
                  ].join(" ")}
                >
                  {submittingEmailOtp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-base font-newsreader-bold" style={{ color: "#FFFFFF" }}>
                      Verify email
                    </Text>
                  )}
                </Pressable>
                <View className="w-full flex-row flex-wrap items-center justify-center gap-x-1 px-0.5">
                  <Text className="text-center text-sm font-playfair text-neutral-600 dark:text-white/65">
                    Didn&apos;t receive the code?
                  </Text>
                  <Pressable onPress={handleResendOTP} hitSlop={8} accessibilityRole="button" accessibilityLabel="Resend email code">
                    <Text className="text-sm font-playfair font-semibold text-primary">Resend code</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {showPhoneVerificationStep ? (
              <View className={`w-full gap-5 ${!emailVerified ? "mt-8 border-t border-neutral-200 pt-6 dark:border-white/10" : ""}`}>
                <View className="w-full">
                  <Text className="text-sm leading-5 font-playfair text-neutral-700 dark:text-white/80">Phone code sent to</Text>
                  <Text
                    className="mt-1 text-sm font-playfair font-semibold leading-5 text-neutral-900 dark:text-white"
                    numberOfLines={2}
                  >
                    {phone}
                  </Text>
                </View>
                <View className="w-full gap-2">
                  <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/90">Phone verification code</Text>
                  <TextInput
                    value={phoneOtpValue}
                    onChangeText={(t) => setPhoneOtpValue(t.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.35)" : "rgba(17,24,39,0.35)"}
                    keyboardType="number-pad"
                    maxLength={6}
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </View>
                <Pressable
                  onPress={handleVerifyPhoneOTP}
                  disabled={submittingPhoneOtp || phoneOtpValue.length !== 6}
                  className={[
                    "min-h-[48px] w-full flex-row items-center justify-center rounded-2xl bg-primary px-4",
                    submittingPhoneOtp || phoneOtpValue.length !== 6 ? "opacity-50" : "opacity-100",
                  ].join(" ")}
                >
                  {submittingPhoneOtp ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-base font-newsreader-bold" style={{ color: "#FFFFFF" }}>
                      Verify phone
                    </Text>
                  )}
                </Pressable>
                <View className="w-full flex-row flex-wrap items-center justify-center gap-x-1 px-0.5">
                  <Text className="text-center text-sm font-playfair text-neutral-600 dark:text-white/65">
                    Didn&apos;t receive the code?
                  </Text>
                  <Pressable onPress={handleResendPhoneOTP} hitSlop={8} accessibilityRole="button" accessibilityLabel="Resend phone code">
                    <Text className="text-sm font-playfair font-semibold text-primary">Resend code</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {!emailVerified && !phone ? (
              <Text className="mt-4 px-1 text-center text-xs leading-4 font-playfair text-neutral-500 dark:text-white/50">
                Add a phone number in your profile to enable phone verification after email is confirmed.
              </Text>
            ) : null}

            <View className="mt-8 w-full flex-row flex-wrap items-center justify-center gap-x-5 gap-y-3 pb-1 pt-2">
              <Pressable onPress={handleSkipForNow} className="min-h-[44px] items-center justify-center px-2 py-2">
                <Text className="text-center text-sm font-playfair font-semibold text-primary">Skip for now</Text>
              </Pressable>
              {!fromProfile ? (
                <Pressable onPress={handleUseDifferentEmail} className="min-h-[44px] items-center justify-center px-2 py-2">
                  <Text className="text-center text-sm font-playfair text-neutral-600 dark:text-white/60">Use a different email</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
