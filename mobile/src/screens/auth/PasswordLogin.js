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
import { useDispatch, useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import { login, selectAuthError, selectAuthLoading } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { toast } from "../../utils/toast";
import HeaderBar from "../../components/HeaderBar";

/** Email + password sign-in for accounts that use a password (web-registered users). */
export default function PasswordLogin({ navigation }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const insets = useSafeAreaInsets();
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !isLoading;
  }, [email, password, isLoading]);

  const onSubmit = () => {
    if (!canSubmit) return;
    dispatch(
      login({
        email: email.trim(),
        password,
      })
    ).then((result) => {
      if (login.fulfilled.match(result)) {
        toast.success("Welcome back.");
        return;
      }
      if (login.rejected.match(result)) {
        const msg =
          typeof result.payload === "string"
            ? result.payload
            : result.payload?.message || "Login failed.";
        toast.error(msg);
      }
    });
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
            paddingBottom: Math.max(insets.bottom, 24) + 24,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <HeaderBar isDark={isDark} topInset={insets.top} onPressLogo={() => navigation.navigate(SCREENS.Login)} />

          <View className="px-5 pt-2">
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              className="mb-3 flex-row items-center gap-1 self-start py-1"
            >
              <Feather name="chevron-left" size={20} color={isDark ? "#F9FAFB" : "#111827"} />
              <Text className="text-sm font-playfair font-semibold text-neutral-700 dark:text-white/80">Back</Text>
            </Pressable>

            <Text className="text-3xl font-newsreader-bold text-neutral-900 dark:text-white text-center">
              Sign in with password
            </Text>
            <Text className="mt-1.5 text-sm font-playfair text-neutral-600 dark:text-white/70 text-center">
              Use this if you created your account with a password on the web.
            </Text>

            <View className="mt-6 gap-3">
              <View className="gap-2">
                <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
                  Email <Text className="text-red-500">*</Text>
                </Text>
                <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                  <Feather name="mail" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 text-base text-neutral-900 dark:text-white"
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
                    placeholder="Password"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 text-base text-neutral-900 dark:text-white"
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                  />
                  <Pressable
                    onPress={() => setPasswordVisible((v) => !v)}
                    accessibilityRole="button"
                    className="p-1.5"
                  >
                    <Feather
                      name={passwordVisible ? "eye-off" : "eye"}
                      size={18}
                      color={isDark ? "rgba(249,250,251,0.8)" : "rgba(17,24,39,0.7)"}
                    />
                  </Pressable>
                </View>
              </View>

              {typeof error === "string" && error ? <Text className="text-sm text-red-500">{error}</Text> : null}

              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                className={[
                  "mt-1 h-12 flex-row items-center justify-center gap-2.5 rounded-2xl bg-primary",
                  canSubmit ? "opacity-100" : "opacity-55",
                ].join(" ")}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Feather name="log-in" size={18} color="#fff" />}
                <Text className="text-base font-newsreader-bold text-white">Sign In</Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate(SCREENS.ForgotPassword)}
                accessibilityRole="button"
                className="items-center py-2"
              >
                <Text className="text-sm font-playfair font-semibold text-primary">Forgot password?</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
