import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
import { useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import authService from "../../services/authService";
import playerService from "../../services/playerService";
import sportService from "../../services/sportService";
import uploadService from "../../services/uploadService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";
import {
  logout,
  selectAuthLoading,
  selectEmailVerified,
  selectUser,
  updateProfile,
} from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";

const getInitial = (user) => {
  const fallback = String(user?.email || "P").trim();
  const text = String(`${user?.firstName || ""} ${user?.lastName || ""}`).trim() || fallback;
  return text ? text.charAt(0).toUpperCase() : "P";
};

function profilePhotoUri(user) {
  const u = String(user?.profilePhoto || "").trim();
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:") || u.startsWith("file:")) return u;
  return null;
}

const imagePickerOptions = {
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.5,
};

/** Same as web player Profile — only valid ObjectIds are persisted. */
const MONGO_OBJECT_ID = /^[a-fA-F0-9]{24}$/;

function normalizeSportDocId(id) {
  if (id == null) return null;
  if (typeof id === "object" && id._id) return String(id._id);
  return String(id);
}

function normalizeSportNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

const LEVEL_OPTIONS = [
  { value: "", label: "Level" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

/** Active profile tab — green glow (iOS shadow + Android elevation + border). */
const ACTIVE_TAB_STYLE = {
  borderWidth: 1.5,
  borderColor: "rgba(52, 211, 153, 0.95)",
  backgroundColor: "rgba(16, 185, 129, 0.22)",
  ...(Platform.OS === "ios"
    ? {
        shadowColor: "#34d399",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 14,
      }
    : {
        elevation: 12,
        shadowColor: "#34d399",
      }),
};

const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType, multiline }) => {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconMuted = isDark ? "rgba(255,255,255,0.75)" : "rgba(31,43,85,0.55)";
  const placeholderColor = isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)";

  return (
    <View className="gap-2">
      <Text className="text-sm font-playfair font-semibold text-neutral-900 dark:text-white/90">{label}</Text>
      <View
        className={[
          "flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5",
          multiline ? "min-h-[110px] py-3 items-start" : "h-12",
        ].join(" ")}
      >
        {icon ? <Feather name={icon} size={18} color={iconMuted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType={keyboardType}
          className="flex-1 text-base text-neutral-900 dark:text-white"
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    </View>
  );
};

export default function Profile({ navigation }) {
  const route = useRoute();
  const organizerShell = Boolean(route.params?.organizerShell);
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isLoading = useSelector(selectAuthLoading);
  const emailVerified = useSelector(selectEmailVerified);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconMuted = isDark ? "rgba(255,255,255,0.8)" : "rgba(31,43,85,0.65)";

  const [activeTab, setActiveTab] = useState("profile"); // profile | address | sports | social
  /** Local pick pending save — { uri, mimeType } */
  const [pickedPhoto, setPickedPhoto] = useState(null);

  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    description: "",
    street: "",
    city: "",
    state: "",
    country: "",
    zipCode: "",
    facebook: "",
    twitter: "",
    instagram: "",
    linkedin: "",
  });

  /** Player sports profile (aligned with web `player/Profile` sports tab). */
  const [playerSports, setPlayerSports] = useState([]);
  const [coachingSports, setCoachingSports] = useState([]);
  const [loadingPlayerSports, setLoadingPlayerSports] = useState(false);
  const [savingSports, setSavingSports] = useState(false);
  const [catalogSports, setCatalogSports] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [sportSearchQuery, setSportSearchQuery] = useState("");

  useEffect(() => {
    setDraft((d) => ({
      ...d,
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      description: user?.description || "",
      street: user?.street || "",
      city: user?.city || "",
      state: user?.state || "",
      country: user?.country || "",
      zipCode: user?.zipCode || "",
      facebook: user?.facebook || "",
      twitter: user?.twitter || "",
      instagram: user?.instagram || "",
      linkedin: user?.linkedin || "",
    }));
  }, [user]);

  useEffect(() => {
    setPickedPhoto(null);
  }, [user?._id, user?.profilePhoto]);

  const fullName = useMemo(() => {
    const n = String(`${draft.firstName} ${draft.lastName}`).trim();
    return n || "Player";
  }, [draft.firstName, draft.lastName]);

  const initial = useMemo(
    () => getInitial({ ...user, firstName: draft.firstName, lastName: draft.lastName }),
    [user, draft.firstName, draft.lastName]
  );
  const avatarUri = useMemo(
    () => pickedPhoto?.uri || profilePhotoUri(user),
    [pickedPhoto?.uri, user]
  );

  const joinedDateText = useMemo(() => {
    if (!user?.createdAt) return null;
    const d = new Date(user.createdAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [user?.createdAt]);

  const playerSportsRef = useRef([]);
  useEffect(() => {
    playerSportsRef.current = playerSports;
  }, [playerSports]);

  const fetchPlayerProfile = useCallback(async () => {
    try {
      setLoadingPlayerSports(true);
      const response = await playerService.getMyProfile();
      const profile = response?.data?.data ?? response?.data;
      const rawSports = Array.isArray(profile?.sports) ? profile.sports : [];

      const normalizedSports = rawSports
        .map((s, index) => {
          const isPopulatedSport = s?.sport && typeof s.sport === "object";
          const sportId = isPopulatedSport ? s.sport?._id : s?.sport;
          const fallbackName = String(s?.sportName || "").trim();
          if (!sportId && !fallbackName) return null;

          const jn = s?.jerseyNumber;
          const jerseyStr = jn != null && jn !== "" ? String(jn) : "";

          return {
            sport: sportId
              ? sportId.toString()
              : `name-only-${normalizeSportNameKey(fallbackName) || index}`,
            sportName: fallbackName || (isPopulatedSport ? s.sport?.name || "" : ""),
            position: s?.position || "",
            jerseyNumber: jerseyStr,
            level: s?.level || "",
          };
        })
        .filter(Boolean);

      setPlayerSports(normalizedSports);

      const populatedDocs = rawSports
        .map((s) => (s?.sport && typeof s.sport === "object" ? s.sport : null))
        .filter(Boolean);
      if (populatedDocs.length) {
        setCoachingSports((prev) => {
          const next = [...prev];
          for (const doc of populatedDocs) {
            const id = String(doc._id || "");
            if (!id || next.some((x) => String(x._id) === id)) continue;
            next.push(doc);
          }
          return next;
        });
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load sports profile.");
    } finally {
      setLoadingPlayerSports(false);
    }
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    fetchPlayerProfile();
  }, [user?._id, fetchPlayerProfile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCatalog(true);
        const res = await sportService.getSportsList();
        const list = res?.data ?? res ?? [];
        const rows = Array.isArray(list) ? list : [];
        if (!cancelled) {
          setCatalogSports(
            rows.map((s) => ({
              _id: normalizeSportDocId(s._id || s.id),
              name: typeof s.name === "string" ? s.name : s?.name?.en || "",
            }))
          );
        }
      } catch {
        if (!cancelled) setCatalogSports([]);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Only used for the type-to-search dropdown — no full list is shown. */
  const sportSearchSuggestions = useMemo(() => {
    const q = sportSearchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return catalogSports
      .filter((s) => String(s.name || "").toLowerCase().includes(q))
      .slice(0, 25);
  }, [catalogSports, sportSearchQuery]);

  const handleAddSportFromCatalog = useCallback((sport) => {
    const id = String(sport?._id || "").trim();
    const name = String(sport?.name || "").trim();
    if (!id || !MONGO_OBJECT_ID.test(id)) {
      toast.error("Choose a sport from the catalog.");
      return;
    }
    if (playerSportsRef.current.some((row) => String(row.sport) === id)) {
      toast.error("This sport is already on your profile.");
      return;
    }
    setCoachingSports((prev) => (prev.some((s) => String(s._id) === id) ? prev : [...prev, { _id: id, name }]));
    setPlayerSports((prev) => [
      ...prev,
      { sport: id, sportName: name, position: "", jerseyNumber: "", level: "" },
    ]);
    toast.success("Sport added. Save sports profile below.");
  }, []);

  const handleRemovePlayerSport = useCallback((sportKey) => {
    setPlayerSports((prev) => prev.filter((s) => s.sport !== sportKey));
  }, []);

  const handleUpdatePlayerSport = useCallback((sportKey, field, value) => {
    setPlayerSports((prev) => prev.map((s) => (s.sport === sportKey ? { ...s, [field]: value } : s)));
  }, []);

  const saveSportsProfile = async () => {
    try {
      setSavingSports(true);
      const sportsPayload = playerSports
        .filter((row) => MONGO_OBJECT_ID.test(String(row.sport || "")))
        .map((row) => {
          const rawJn = row.jerseyNumber;
          const numJn =
            rawJn === "" || rawJn == null ? null : Number(String(rawJn).replace(/[^0-9.-]/g, ""));
          return {
            sport: String(row.sport),
            sportName: String(row.sportName || "").trim(),
            position: String(row.position || "").trim(),
            jerseyNumber: numJn != null && Number.isFinite(numJn) ? numJn : null,
            level: String(row.level || "").trim(),
          };
        });

      await playerService.updateMyProfile({ sports: sportsPayload });
      await fetchPlayerProfile();
      toast.success("Sports profile updated.");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not save sports profile.");
    } finally {
      setSavingSports(false);
    }
  };

  const applyPickedAsset = useCallback((asset) => {
    if (!asset?.uri) return;
    setPickedPhoto({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
    });
  }, []);

  const openPhotoLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Photo library access is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        ...imagePickerOptions,
      });
      if (!result.canceled && result.assets?.[0]) applyPickedAsset(result.assets[0]);
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
        ...imagePickerOptions,
      });
      if (!result.canceled && result.assets?.[0]) applyPickedAsset(result.assets[0]);
    } catch {
      toast.error("Could not open camera.");
    }
  }, [applyPickedAsset]);

  const onChangeProfilePhoto = useCallback(() => {
    if (Platform.OS === "web") {
      openPhotoLibrary();
      return;
    }
    Alert.alert("Profile photo", "Choose a source", [
      { text: "Photo library", onPress: openPhotoLibrary },
      { text: "Camera", onPress: openCamera },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [openCamera, openPhotoLibrary]);

  const saveProfile = async () => {
    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
      description: draft.description.trim(),
      street: draft.street.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      country: draft.country.trim(),
      zipCode: draft.zipCode.trim(),
      facebook: draft.facebook.trim(),
      twitter: draft.twitter.trim(),
      instagram: draft.instagram.trim(),
      linkedin: draft.linkedin.trim(),
    };

    try {
      if (pickedPhoto?.uri) {
        const file = {
          uri: pickedPhoto.uri,
          type: pickedPhoto.mimeType || "image/jpeg",
          name: "profile.jpg",
        };
        const uploadRes = await uploadService.uploadProfilePhoto(file);
        const url = uploadRes?.data?.url ?? uploadRes?.url;
        if (!url || typeof url !== "string") {
          toast.error(uploadRes?.message || "Upload did not return a photo URL.");
          return;
        }
        payload.profilePhoto = url;
      }

      const res = await dispatch(updateProfile(payload));
      if (updateProfile.fulfilled.match(res)) {
        setPickedPhoto(null);
        toast.success("Profile updated.");
        return;
      }
      toast.error(res.payload || "Failed to update profile.");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to update profile.");
    }
  };

  const sendVerificationOtp = async (mode) => {
    if (!user?.email) return;
    try {
      toast.loading("Sending code...");
      if (mode === "phone") {
        await authService.sendPhoneOTP({ email: user.email, phone: user?.phone });
      } else {
        await authService.sendOTP(user.email);
      }
      toast.dismiss();
      toast.success("Code sent.");
      navigation.navigate(SCREENS.VerifyAccount, {
        email: user.email,
        phone: user?.phone,
        fromProfile: true,
      });
    } catch (e) {
      toast.dismiss();
      toast.error(e?.response?.data?.message || "Failed to send code.");
    }
  };

  const onLogout = async () => {
    try {
      toast.loading("Signing out...");
      await authService.logout();
    } catch {
      // ignore network errors; we still clear local session
    } finally {
      toast.dismiss();
      dispatch(logout());
      toast.success("Signed out.");
    }
  };

  const TabBtn = ({ id, label, icon }) => {
    const active = activeTab === id;
    return (
      <Pressable
        onPress={() => setActiveTab(id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-2"
        style={active ? ACTIVE_TAB_STYLE : { backgroundColor: "transparent" }}
      >
        <Feather name={icon} size={16} color={active ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
        <Text className={[active ? "text-white" : "text-white/70", "text-sm font-newsreader-bold"].join(" ")}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar
        title="Profile"
        {...(organizerShell
          ? { onPressNotifications: () => navigation.navigate(SCREENS.Notifications) }
          : {})}
      />
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
          {/* Profile card — horizontal contact sheet */}
          <View className="rounded-3xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <View className="flex-row items-center gap-4">
              <View className="h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F2B55]">
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Text className="text-4xl font-newsreader-bold text-white">{initial}</Text>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-xl font-newsreader-bold text-neutral-900 dark:text-white"
                  numberOfLines={2}
                >
                  {fullName}
                </Text>
                <View className="mt-1.5 self-start rounded-full bg-primary/10 px-3 py-1 dark:bg-white/10">
                  <Text className="text-xs font-playfair font-semibold text-primary dark:text-white/85">Player</Text>
                </View>
              </View>
            </View>

            <View className="my-4 h-px bg-neutral-200 dark:bg-white/10" />

            <View>
              <View className="flex-row items-center border-b border-neutral-200 py-3 dark:border-white/10">
                <Feather name="mail" size={18} color={iconMuted} />
                <Text className="ml-3 w-[68px] shrink-0 pt-0.5 text-sm font-playfair text-neutral-500 dark:text-white/55">
                  Email
                </Text>
                <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
                  <Text
                    className="min-w-0 flex-1 text-right text-sm font-playfair text-neutral-800 dark:text-white/85"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {user?.email || "—"}
                  </Text>
                  {emailVerified ? (
                    <View className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1">
                      <Text className="text-xs font-newsreader-bold text-emerald-700 dark:text-emerald-300">
                        Verified
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => sendVerificationOtp("email")}
                      accessibilityRole="button"
                      accessibilityLabel="Verify email"
                      className="shrink-0 rounded-xl bg-primary px-3 py-1.5"
                    >
                      <Text className="text-xs font-newsreader-bold text-white">Verify</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View className="flex-row items-center border-b border-neutral-200 py-3 dark:border-white/10">
                <Feather name="phone" size={18} color={iconMuted} />
                <Text className="ml-3 w-[68px] shrink-0 pt-0.5 text-sm font-playfair text-neutral-500 dark:text-white/55">
                  Phone
                </Text>
                <Text
                  className="min-w-0 flex-1 text-right text-sm font-playfair text-neutral-800 dark:text-white/85"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {user?.phone?.trim() ? user.phone : "—"}
                </Text>
              </View>

              {joinedDateText ? (
                <View className="flex-row items-center py-3">
                  <Feather name="calendar" size={18} color={iconMuted} />
                  <Text className="ml-3 w-[68px] shrink-0 pt-0.5 text-sm font-playfair text-neutral-500 dark:text-white/55">
                    Joined
                  </Text>
                  <Text
                    className="min-w-0 flex-1 text-right text-sm font-playfair text-neutral-800 dark:text-white/85"
                    numberOfLines={1}
                  >
                    {joinedDateText}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Tabs */}
          <View className="mt-5 rounded-3xl bg-[#1F2B55] p-2">
            <View className="flex-row gap-2">
              <TabBtn id="profile" label="Profile" icon="user" />
              <TabBtn id="address" label="Address" icon="map-pin" />
              <TabBtn id="sports" label="Sports" icon="activity" />
              <TabBtn id="social" label="Social" icon="link" />
            </View>
          </View>

          {/* Tab content */}
          <View className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            {activeTab === "profile" ? (
              <View className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-playfair font-semibold text-neutral-900 dark:text-white/90">
                    Profile photo
                  </Text>
                  <View className="flex-row items-center gap-4">
                    <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#1F2B55]">
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" />
                      ) : (
                        <Text className="text-3xl font-newsreader-bold text-white">{initial}</Text>
                      )}
                    </View>
                    <Pressable
                      onPress={onChangeProfilePhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Change profile photo"
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <View className="flex-row items-center gap-2">
                        <Feather name="camera" size={18} color={iconMuted} />
                        <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">
                          Change photo
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                  <Text className="text-xs font-playfair text-neutral-500 dark:text-white/55">
                    Tap Save changes below to upload a new photo.
                  </Text>
                </View>

                <Field
                  label="First name"
                  icon="user"
                  value={draft.firstName}
                  onChangeText={(v) => setDraft((d) => ({ ...d, firstName: v }))}
                  placeholder="First name"
                />
                <Field
                  label="Last name"
                  icon="user"
                  value={draft.lastName}
                  onChangeText={(v) => setDraft((d) => ({ ...d, lastName: v }))}
                  placeholder="Last name"
                />
                <Field
                  label="Phone"
                  icon="phone"
                  value={draft.phone}
                  onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
                <Field
                  label="About"
                  icon="edit-2"
                  value={draft.description}
                  onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
                  placeholder="Tell us about yourself"
                  multiline
                />
              </View>
            ) : null}

            {activeTab === "address" ? (
              <View className="gap-4">
                <Field
                  label="Street"
                  icon="map-pin"
                  value={draft.street}
                  onChangeText={(v) => setDraft((d) => ({ ...d, street: v }))}
                  placeholder="Street"
                />
                <Field
                  label="City"
                  icon="map-pin"
                  value={draft.city}
                  onChangeText={(v) => setDraft((d) => ({ ...d, city: v }))}
                  placeholder="City"
                />
                <Field
                  label="State"
                  icon="map"
                  value={draft.state}
                  onChangeText={(v) => setDraft((d) => ({ ...d, state: v }))}
                  placeholder="State"
                />
                <Field
                  label="Country"
                  icon="globe"
                  value={draft.country}
                  onChangeText={(v) => setDraft((d) => ({ ...d, country: v }))}
                  placeholder="Country"
                />
                <Field
                  label="Zip code"
                  icon="hash"
                  value={draft.zipCode}
                  onChangeText={(v) => setDraft((d) => ({ ...d, zipCode: v }))}
                  placeholder="Zip code"
                  keyboardType="number-pad"
                />
              </View>
            ) : null}

            {activeTab === "sports" ? (
              <View className="gap-4">
                <View>
                  <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white">
                    My Sports Profile
                  </Text>
                  <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
                    Type to search the sports catalog, pick a match to add it, then set position, jersey number, and
                    skill level. Save when you are done.
                  </Text>
                </View>

                {loadingPlayerSports ? (
                  <View className="items-center py-2">
                    <ActivityIndicator />
                  </View>
                ) : null}

                <View className="gap-2">
                  <Text className="text-xs font-newsreader-bold uppercase tracking-wider text-neutral-500 dark:text-white/50">
                    Search and add sport
                  </Text>
                  <View className="relative z-10">
                    <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                      <Feather name="search" size={18} color={iconMuted} />
                      {loadingCatalog ? (
                        <View className="flex-1 flex-row items-center gap-2">
                          <ActivityIndicator size="small" />
                          <Text className="text-sm font-playfair text-neutral-500 dark:text-white/55">
                            Loading sports…
                          </Text>
                        </View>
                      ) : (
                        <TextInput
                          value={sportSearchQuery}
                          onChangeText={setSportSearchQuery}
                          placeholder="Type to search (e.g. Football, Cricket)..."
                          placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                          autoCorrect={false}
                          autoCapitalize="none"
                          className="flex-1 text-base text-neutral-900 dark:text-white"
                        />
                      )}
                    </View>

                    {!loadingCatalog && sportSearchQuery.trim().length > 0 ? (
                      sportSearchSuggestions.length > 0 ? (
                        <View
                          className="mt-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
                          style={{ maxHeight: 220 }}
                        >
                          <ScrollView
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                          >
                            {sportSearchSuggestions.map((s) => {
                              const id = String(s._id || "");
                              if (!id) return null;
                              return (
                                <Pressable
                                  key={id}
                                  onPress={() => {
                                    handleAddSportFromCatalog(s);
                                    setSportSearchQuery("");
                                    Keyboard.dismiss();
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Add ${s.name}`}
                                  className="border-b border-neutral-100 px-4 py-3.5 active:bg-neutral-50 dark:border-white/10 dark:active:bg-white/10"
                                >
                                  <Text className="text-base font-playfair text-neutral-900 dark:text-white">
                                    {s.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : (
                        <Text className="mt-2 px-1 text-sm font-playfair text-neutral-500 dark:text-white/55">
                          No sports match your search.
                        </Text>
                      )
                    ) : null}
                  </View>
                </View>

                {playerSports.length > 0 ? (
                  <View className="gap-3">
                    <Text className="text-xs font-newsreader-bold uppercase tracking-wider text-neutral-500 dark:text-white/50">
                      Your sports
                    </Text>
                    {playerSports.map((ps) => {
                      const sportObj = coachingSports.find((x) => String(x._id) === String(ps.sport));
                      const sportName = sportObj?.name || ps.sportName || "Unknown";
                      return (
                        <View
                          key={String(ps.sport)}
                          className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                        >
                          <View className="mb-3 flex-row items-center justify-between gap-2">
                            <View className="min-w-0 flex-1 flex-row items-center gap-2">
                              <Feather name="activity" size={20} color={iconMuted} />
                              <Text
                                className="text-base font-newsreader-bold text-neutral-900 dark:text-white"
                                numberOfLines={1}
                              >
                                {sportName}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleRemovePlayerSport(ps.sport)}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${sportName}`}
                              className="rounded-xl p-2"
                            >
                              <Feather name="x" size={20} color={iconMuted} />
                            </Pressable>
                          </View>

                          <View className="gap-3">
                            <View className="gap-2">
                              <Text className="text-xs font-playfair font-semibold text-neutral-600 dark:text-white/70">
                                Position
                              </Text>
                              <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                                <TextInput
                                  value={ps.position}
                                  onChangeText={(v) => handleUpdatePlayerSport(ps.sport, "position", v)}
                                  placeholder="e.g. Batsman, Goalkeeper"
                                  placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                                  className="flex-1 text-base text-neutral-900 dark:text-white"
                                />
                              </View>
                            </View>
                            <View className="gap-2">
                              <Text className="text-xs font-playfair font-semibold text-neutral-600 dark:text-white/70">
                                Jersey number
                              </Text>
                              <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                                <TextInput
                                  value={String(ps.jerseyNumber ?? "")}
                                  onChangeText={(v) => handleUpdatePlayerSport(ps.sport, "jerseyNumber", v.replace(/[^0-9]/g, ""))}
                                  placeholder="e.g. 7"
                                  keyboardType="number-pad"
                                  placeholderTextColor={isDark ? "rgba(249,250,251,0.45)" : "rgba(17,24,39,0.35)"}
                                  className="flex-1 text-base text-neutral-900 dark:text-white"
                                />
                              </View>
                            </View>
                            <View className="gap-2">
                              <Text className="text-xs font-playfair font-semibold text-neutral-600 dark:text-white/70">
                                Skill level
                              </Text>
                              <View className="flex-row flex-wrap gap-2">
                                {LEVEL_OPTIONS.filter((o) => o.value !== "").map((o) => {
                                  const on = ps.level === o.value;
                                  return (
                                    <Pressable
                                      key={o.value}
                                      onPress={() => handleUpdatePlayerSport(ps.sport, "level", o.value)}
                                      className={[
                                        "rounded-full border px-3 py-2",
                                        on
                                          ? "border-primary bg-primary"
                                          : "border-neutral-200 bg-white dark:border-white/15 dark:bg-white/5",
                                      ].join(" ")}
                                    >
                                      <Text
                                        className={[
                                          "text-xs font-newsreader-bold",
                                          on ? "text-white" : "text-neutral-800 dark:text-white/90",
                                        ].join(" ")}
                                      >
                                        {o.label}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View className="items-center rounded-2xl bg-neutral-50 py-8 dark:bg-white/5">
                    <Feather name="activity" size={40} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(31,43,85,0.2)"} />
                    <Text className="mt-2 text-center font-playfair font-semibold text-neutral-600 dark:text-white/70">
                      No sports added yet
                    </Text>
                    <Text className="mt-1 px-4 text-center text-sm font-playfair text-neutral-500 dark:text-white/55">
                      Search above to add sports so academies can find you.
                    </Text>
                  </View>
                )}

                {playerSports.length > 0 ? (
                  <Pressable
                    onPress={saveSportsProfile}
                    disabled={savingSports}
                    className={[
                      "h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-primary",
                      savingSports ? "opacity-70" : "opacity-100",
                    ].join(" ")}
                  >
                    {savingSports ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Feather name="save" size={18} color="#fff" />
                    )}
                    <Text className="text-base font-newsreader-bold text-white">Save sports profile</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {activeTab === "social" ? (
              <View className="gap-4">
                <Field
                  label="Facebook"
                  icon="facebook"
                  value={draft.facebook}
                  onChangeText={(v) => setDraft((d) => ({ ...d, facebook: v }))}
                  placeholder="Facebook URL"
                />
                <Field
                  label="Twitter"
                  icon="twitter"
                  value={draft.twitter}
                  onChangeText={(v) => setDraft((d) => ({ ...d, twitter: v }))}
                  placeholder="Twitter URL"
                />
                <Field
                  label="Instagram"
                  icon="instagram"
                  value={draft.instagram}
                  onChangeText={(v) => setDraft((d) => ({ ...d, instagram: v }))}
                  placeholder="Instagram URL"
                />
                <Field
                  label="LinkedIn"
                  icon="linkedin"
                  value={draft.linkedin}
                  onChangeText={(v) => setDraft((d) => ({ ...d, linkedin: v }))}
                  placeholder="LinkedIn URL"
                />
                <Text className="text-xs font-playfair text-neutral-600 dark:text-white/70">
                  Tip: paste full links (https://...) so they work everywhere.
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={saveProfile}
              disabled={isLoading}
              className={[
                "mt-6 h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-primary",
                isLoading ? "opacity-70" : "opacity-100",
              ].join(" ")}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Feather name="save" size={18} color="#fff" />}
              <Text className="text-base font-newsreader-bold text-white">Save changes</Text>
            </Pressable>

            <Pressable
              onPress={onLogout}
              accessibilityRole="button"
              className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10"
            >
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text className="text-base font-newsreader-bold text-red-600">Logout</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
