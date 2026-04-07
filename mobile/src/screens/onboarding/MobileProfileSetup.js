import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import {
  clearMobileOnboardingProfilePhoto,
  selectNeedsOnboarding,
  selectUser,
  setMobileOnboardingProfilePhoto,
} from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { toast } from "../../utils/toast";
import HeaderBar from "../../components/HeaderBar";

const AVATAR_SIZE = 128;

const pickerOptions = {
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.45,
  base64: true,
};

function deriveInitialNames(user, needsOnboarding) {
  if (!needsOnboarding) return { first: "", last: "" };
  const f = String(user?.firstName || "").trim();
  const l = String(user?.lastName || "").trim();
  if (!f) return { first: "", last: l };
  if (f.toLowerCase() === "player" && !l) return { first: "", last: "" };
  return { first: f, last: l };
}

export default function MobileProfileSetup({ navigation }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const user = useSelector(selectUser);
  const needsOnboarding = useSelector(selectNeedsOnboarding);
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [previewUri, setPreviewUri] = useState(null);

  useEffect(() => {
    const { first, last } = deriveInitialNames(user, needsOnboarding);
    setFirstName(first);
    setLastName(last);
  }, [user?._id, user?.firstName, user?.lastName, needsOnboarding]);

  useEffect(() => {
    const url = String(user?.profilePhoto || "").trim();
    if (url && (url.startsWith("http") || url.startsWith("data:"))) {
      setPreviewUri(url);
    }
  }, [user?.profilePhoto]);

  const applyPickedAsset = useCallback(
    (asset) => {
      if (!asset?.uri) return;
      setPreviewUri(asset.uri);
      if (asset.base64) {
        const mime = asset.mimeType || "image/jpeg";
        dispatch(setMobileOnboardingProfilePhoto(`data:${mime};base64,${asset.base64}`));
      } else {
        dispatch(clearMobileOnboardingProfilePhoto());
        toast.error("Could not read image data. Try another photo.");
      }
    },
    [dispatch]
  );

  const openLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        ...pickerOptions,
      });
      if (!result.canceled && result.assets?.[0]) {
        applyPickedAsset(result.assets[0]);
      }
    } catch {
      toast.error("Could not open photo library.");
    }
  }, [applyPickedAsset]);

  const openCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast.error("Camera access is required.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        ...pickerOptions,
      });
      if (!result.canceled && result.assets?.[0]) {
        applyPickedAsset(result.assets[0]);
      }
    } catch {
      toast.error("Could not open camera.");
    }
  }, [applyPickedAsset]);

  const onAvatarPress = useCallback(() => {
    if (Platform.OS === "web") {
      openLibrary();
      return;
    }
    Alert.alert("Profile photo", "Choose a source", [
      { text: "Photo library", onPress: openLibrary },
      { text: "Camera", onPress: openCamera },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [openCamera, openLibrary]);

  const canSubmit = useMemo(() => {
    return firstName.trim().length >= 1 && lastName.trim().length >= 1;
  }, [firstName, lastName]);

  const onSubmit = () => {
    if (!canSubmit) return;
    navigation.navigate(SCREENS.MobileSportsSelection, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
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
          <HeaderBar isDark={isDark} topInset={insets.top} onPressLogo={() => {}} />

          <View className="items-center px-5 pt-4">
            <Text className="text-2xl font-newsreader-bold text-neutral-900 dark:text-white text-center">
              Personal data
            </Text>
            <Text className="mt-1.5 max-w-sm text-center text-sm font-playfair text-neutral-600 dark:text-white/70">
              Add your photo and name. Photo is optional.
            </Text>

            <Pressable
              onPress={onAvatarPress}
              accessibilityRole="button"
              accessibilityLabel="Choose profile photo"
              className="mt-8 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 dark:border-white/25 dark:bg-white/5"
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            >
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  className="rounded-full"
                  style={{ width: AVATAR_SIZE - 4, height: AVATAR_SIZE - 4 }}
                  resizeMode="cover"
                />
              ) : (
                <Feather name="camera" size={36} color={isDark ? "rgba(249,250,251,0.5)" : "rgba(17,24,39,0.35)"} />
              )}
            </Pressable>
            <Pressable onPress={onAvatarPress} className="mt-2 py-1">
              <Text className="text-xs font-playfair font-semibold text-primary">Tap to add photo</Text>
            </Pressable>

            <View className="mt-8 w-full max-w-md gap-4">
              <View className="gap-2">
                <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
                  First name <Text className="text-red-500">*</Text>
                </Text>
                <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                  <Feather name="user" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="first name"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                    autoCapitalize="words"
                    className="flex-1 text-base text-neutral-900 dark:text-white"
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-sm font-playfair font-semibold text-neutral-800 dark:text-white/80">
                  Last name <Text className="text-red-500">*</Text>
                </Text>
                <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                  <Feather name="user" size={18} color={isDark ? "rgba(249,250,251,0.75)" : "rgba(17,24,39,0.55)"} />
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="last name"
                    placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                    autoCapitalize="words"
                    className="flex-1 text-base text-neutral-900 dark:text-white"
                  />
                </View>
              </View>

              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                className={[
                  "mt-2 h-12 flex-row items-center justify-center rounded-full bg-primary",
                  canSubmit ? "opacity-100" : "opacity-55",
                ].join(" ")}
              >
                <Text className="text-base font-newsreader-bold text-white">Submit</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
