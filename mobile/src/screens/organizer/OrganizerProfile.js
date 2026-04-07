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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import LabeledIconInput from "../../components/forms/LabeledIconInput";
import PrimaryButton from "../../components/forms/PrimaryButton";
import { SCREENS } from "../../constants/navigation";
import authService from "../../services/authService";
import sportService from "../../services/sportService";
import uploadService from "../../services/uploadService";
import { getMe, logout, selectUser, updateProfile } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { getSubscriptionTag } from "../../utils/subscriptionStatus";
import { toast } from "../../utils/toast";
import { clearOrgDraft, loadOrgDraft, saveOrgDraft } from "./organizerOrgDraftStorage";

const MONGO_OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TABS = [
  { id: "organization", label: "", icon: "briefcase" },
  { id: "address", label: "", icon: "map-pin" },
  { id: "sports", label: "", icon: "activity" },
  { id: "social", label: "", icon: "link" },
];

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeSportDocId(id) {
  if (id == null) return null;
  if (typeof id === "object" && id._id) return String(id._id);
  return String(id);
}

function validatePickedImage(asset) {
  const mime = asset?.mimeType || "";
  if (mime && !String(mime).startsWith("image/")) {
    toast.error("Please choose an image file");
    return false;
  }
  if (asset?.fileSize != null && asset.fileSize > MAX_IMAGE_BYTES) {
    toast.error("Image must be under 5MB");
    return false;
  }
  return true;
}

function buildOrgFormFromUser(user) {
  return {
    organizationName: user?.organizationName || "",
    street: user?.address?.street || user?.street || "",
    city: user?.address?.city || user?.city || "",
    state: user?.address?.state || user?.state || "",
    country: user?.address?.country || user?.country || "",
    zipCode: user?.address?.zipCode || user?.zipCode || "",
    facebook: user?.socialLinks?.facebook || user?.facebook || "",
    twitter: user?.socialLinks?.twitter || user?.twitter || "",
    instagram: user?.socialLinks?.instagram || user?.instagram || "",
    linkedin: user?.socialLinks?.linkedin || user?.linkedin || "",
  };
}

/** Below this width, stack avatar above text for readable wrapping on small phones. */
const PROFILE_CARD_STACK_BREAKPOINT = 380;

export default function OrganizerProfile() {
  const { width: windowWidth } = useWindowDimensions();
  const stackProfileCard = windowWidth < PROFILE_CARD_STACK_BREAKPOINT;
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)";

  const [activeTab, setActiveTab] = useState("organization");
  const [profileData, setProfileData] = useState(() => buildOrgFormFromUser(null));
  const [organizerSportIds, setOrganizerSportIds] = useState([]);
  const [organizerSportLabels, setOrganizerSportLabels] = useState({});
  const [savingOrganizerSports, setSavingOrganizerSports] = useState(false);
  const [savingOrgDetails, setSavingOrgDetails] = useState(false);
  const [catalogSports, setCatalogSports] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [sportSearchQuery, setSportSearchQuery] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const draftHydratedRef = useRef(false);
  const unsavedRef = useRef(false);

  useEffect(() => {
    dispatch(getMe());
  }, [dispatch]);

  const applyUserAndDraft = useCallback(async () => {
    if (!user?._id) return;
    const base = buildOrgFormFromUser(user);
    const draft = await loadOrgDraft(user._id);
    let merged = { ...base };
    let hadDraft = false;
    if (draft && typeof draft === "object") {
      hadDraft = true;
      merged = {
        ...merged,
        organizationName: draft.organizationName ?? merged.organizationName,
        street: draft.street ?? merged.street,
        city: draft.city ?? merged.city,
        state: draft.state ?? merged.state,
        country: draft.country ?? merged.country,
        zipCode: draft.zipCode ?? merged.zipCode,
        facebook: draft.facebook ?? merged.facebook,
        twitter: draft.twitter ?? merged.twitter,
        instagram: draft.instagram ?? merged.instagram,
        linkedin: draft.linkedin ?? merged.linkedin,
      };
    }
    setProfileData(merged);

    const rawSports = user?.organizerSports;
    const idsFromUser = Array.isArray(rawSports)
      ? rawSports.map((x) => String(x?._id || x || "").trim()).filter(Boolean)
      : [];
    if (Array.isArray(draft?.organizerSportIds) && draft.organizerSportIds.length) {
      setOrganizerSportIds(draft.organizerSportIds.map(String));
    } else {
      setOrganizerSportIds(idsFromUser);
    }
    const labels = {};
    for (const x of rawSports || []) {
      if (x && typeof x === "object" && x._id && x.name) {
        labels[String(x._id)] = x.name;
      }
    }
    setOrganizerSportLabels((prev) => ({ ...prev, ...labels }));

    draftHydratedRef.current = true;
    unsavedRef.current = hadDraft;
  }, [user]);

  useEffect(() => {
    applyUserAndDraft();
  }, [applyUserAndDraft]);

  useEffect(() => {
    if (!user?._id || !draftHydratedRef.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      await saveOrgDraft(user._id, {
        ...profileData,
        organizerSportIds,
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [profileData, organizerSportIds, user?._id]);

  useEffect(() => {
    setLogoBroken(false);
  }, [user?.organizationLogo]);

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

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      Alert.alert("Discard changes?", "You have unsaved organization edits.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            unsavedRef.current = false;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return sub;
  }, [navigation]);

  const sportSearchSuggestions = useMemo(() => {
    const q = sportSearchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return catalogSports.filter((s) => String(s.name || "").toLowerCase().includes(q)).slice(0, 25);
  }, [catalogSports, sportSearchQuery]);

  const subscriptionTag = useMemo(() => getSubscriptionTag(user), [user]);

  const displayOrgName = useMemo(
    () => String(profileData.organizationName || user?.organizationName || "Your organization").trim() || "Organization",
    [profileData.organizationName, user?.organizationName]
  );

  const markDirty = useCallback(() => {
    unsavedRef.current = true;
  }, []);

  const setField = useCallback(
    (patch) => {
      markDirty();
      setProfileData((p) => ({ ...p, ...patch }));
    },
    [markDirty]
  );

  const handlePickOrganizerSport = (id, sport) => {
    const sid = String(id || "").trim();
    if (!sid || !MONGO_OBJECT_ID.test(sid)) {
      toast.error("Invalid sport");
      return;
    }
    if (organizerSportIds.includes(sid)) {
      toast.error("Sport already added");
      return;
    }
    markDirty();
    setOrganizerSportIds((prev) => [...prev, sid]);
    if (sport?.name) {
      setOrganizerSportLabels((prev) => ({ ...prev, [sid]: sport.name }));
    }
    setSportSearchQuery("");
    Keyboard.dismiss();
  };

  const removeOrganizerSportChip = (id) => {
    markDirty();
    setOrganizerSportIds((prev) => prev.filter((x) => x !== id));
  };

  const saveOrganizerSportsOnly = async () => {
    setSavingOrganizerSports(true);
    try {
      await dispatch(updateProfile({ organizerSports: organizerSportIds })).unwrap();
      await dispatch(getMe()).unwrap();
      const uid = user?._id;
      if (uid) {
        await saveOrgDraft(uid, { ...profileData, organizerSportIds });
      }
      toast.success("Sports saved. They will appear in Sports configuration.");
    } catch (e) {
      toast.error(typeof e === "string" ? e : e?.message || "Failed to save sports");
    } finally {
      setSavingOrganizerSports(false);
    }
  };

  const uploadOrgLogoFromAsset = useCallback(
    async (asset) => {
      if (!validatePickedImage(asset)) return;
      setUploadingLogo(true);
      try {
        const file = { uri: asset.uri, name: "logo.jpg", type: asset.mimeType || "image/jpeg" };
        const uploadRes = await uploadService.uploadTeamLogo(file);
        const url = uploadRes?.data?.url ?? uploadRes?.url;
        if (!url) throw new Error("No URL from upload");
        await dispatch(updateProfile({ organizationLogo: url })).unwrap();
        await dispatch(getMe()).unwrap();
        toast.success("Organization logo updated");
      } catch (e) {
        toast.error(getErrorMessage(e) || "Upload failed");
      } finally {
        setUploadingLogo(false);
      }
    },
    [dispatch]
  );

  const openOrgLogoPhotoLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Photo library permission is required");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) await uploadOrgLogoFromAsset(result.assets[0]);
    } catch {
      toast.error("Could not open photo library.");
    }
  }, [uploadOrgLogoFromAsset]);

  const openOrgLogoCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast.error("Camera permission is required");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) await uploadOrgLogoFromAsset(result.assets[0]);
    } catch {
      toast.error("Could not open camera.");
    }
  }, [uploadOrgLogoFromAsset]);

  const pickAndUploadOrgLogo = useCallback(() => {
    if (Platform.OS === "web") {
      openOrgLogoPhotoLibrary();
      return;
    }
    Alert.alert("Organization logo", "Choose a source", [
      { text: "Photo library", onPress: openOrgLogoPhotoLibrary },
      { text: "Camera", onPress: openOrgLogoCamera },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [openOrgLogoCamera, openOrgLogoPhotoLibrary]);

  const saveOrganizationDetails = async () => {
    if (!String(profileData.organizationName || "").trim()) {
      toast.error("Organization name is required");
      return;
    }
    setSavingOrgDetails(true);
    try {
      await dispatch(
        updateProfile({
          organizationName: profileData.organizationName.trim(),
          address: {
            street: profileData.street.trim(),
            city: profileData.city.trim(),
            state: profileData.state.trim(),
            country: profileData.country.trim(),
            zipCode: profileData.zipCode.trim(),
          },
          socialLinks: {
            facebook: profileData.facebook.trim(),
            twitter: profileData.twitter.trim(),
            instagram: profileData.instagram.trim(),
            linkedin: profileData.linkedin.trim(),
          },
        })
      ).unwrap();
      await dispatch(getMe()).unwrap();
      if (user?._id) await clearOrgDraft(user._id);
      await applyUserAndDraft();
      unsavedRef.current = false;
      toast.success("Organization updated");
    } catch (e) {
      toast.error(typeof e === "string" ? e : e?.message || "Update failed");
    } finally {
      setSavingOrgDetails(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  const TabBtn = ({ id, label, icon }) => {
    const active = activeTab === id;
    const hasLabel = Boolean(String(label || "").trim());
    const iconSize = hasLabel ? 16 : 20;
    const isOrgTab = id === "organization";
    const isSportsTab = id === "sports";
    return (
      <Pressable
        onPress={() => setActiveTab(id)}
        className={`flex-1 rounded-full px-3 ${hasLabel ? "py-2.5" : "py-3"} ${
          active ? "bg-primary" : "border border-neutral-200 dark:border-white/15"
        }`}
      >
        <View className={`flex-row items-center justify-center ${hasLabel ? "gap-2" : ""}`}>
          {isOrgTab ? (
            <Octicons
              name="organization"
              size={iconSize + 2}
              color={active ? "#fff" : isDark ? "#e5e7eb" : "#374151"}
            />
          ) : isSportsTab ? (
            <MaterialIcons
              name="sports-cricket"
              size={iconSize + 2}
              color={active ? "#fff" : isDark ? "#e5e7eb" : "#374151"}
            />
          ) : (
            <Feather name={icon} size={iconSize} color={active ? "#fff" : isDark ? "#e5e7eb" : "#374151"} />
          )}
          {hasLabel ? (
            <Text
              className={`font-playfair text-sm ${active ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const showLogo = user?.organizationLogo && !logoBroken;

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Organization" onPressNotifications={() => navigation.navigate(SCREENS.Notifications)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">Organization profile</Text>
        <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white">
          Manage your organization name, logo, catalog sports, address, and public links. Personal account settings are
          not shown here.
        </Text>

        <View className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <View className={stackProfileCard ? "flex-col items-center gap-4" : "flex-row items-start gap-4"}>
            <View className={`relative shrink-0 ${stackProfileCard ? "" : "pt-0.5"}`}>
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#1F2B55]">
                {showLogo ? (
                  <Image
                    source={{ uri: user.organizationLogo }}
                    className="h-full w-full"
                    resizeMode="cover"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  <Feather name="briefcase" size={40} color="#fff" />
                )}
              </View>
              <Pressable
                onPress={pickAndUploadOrgLogo}
                disabled={uploadingLogo}
                hitSlop={8}
                className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary p-2 shadow-sm"
              >
                {uploadingLogo ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="camera" size={18} color="#fff" />}
              </Pressable>
            </View>
            <View
              className={`min-w-0 self-stretch ${stackProfileCard ? "w-full items-center" : "flex-1"}`}
              style={stackProfileCard ? undefined : { paddingTop: 2 }}
            >
              <Text
                className={`text-xl font-newsreader-bold text-neutral-900 dark:text-white ${stackProfileCard ? "text-center" : "text-left"}`}
                numberOfLines={3}
              >
                {displayOrgName}
              </Text>
              <View
                className={`mt-2 flex-row flex-wrap gap-x-2 gap-y-2 ${stackProfileCard ? "mt-3 w-full justify-center" : "justify-start"}`}
              >
                <View
                  className={`max-w-full shrink rounded-full px-3 py-1 ${subscriptionTag.variant === "success"
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : subscriptionTag.variant === "danger"
                        ? "bg-red-100 dark:bg-red-900/40"
                        : "bg-amber-100 dark:bg-amber-900/40"
                    }`}
                >
                  <Text
                    className="text-xs font-newsreader-bold text-neutral-800 dark:text-white"
                    numberOfLines={2}
                  >
                    {subscriptionTag.label}
                  </Text>
                </View>
                <View className="max-w-full shrink rounded-full bg-neutral-100 px-3 py-1 dark:bg-white/10">
                  <Text
                    className="text-xs font-playfair text-neutral-700 dark:text-white"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Plan: {user?.subscriptionPlan || "Free"}
                  </Text>
                </View>
              </View>
              {user?.subscriptionExpiry ? (
                <Text
                  className={`mt-2 font-playfair text-xs text-neutral-500 dark:text-white ${stackProfileCard ? "text-center" : "text-left"}`}
                >
                  Expires {formatDateShort(user.subscriptionExpiry)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>



        <View className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <View className="flex-row gap-2">
            {TABS.map((t) => (
              <TabBtn key={t.id} id={t.id} label={t.label} icon={t.icon} />
            ))}
          </View>
          <View className="mt-4 h-px bg-neutral-200 dark:bg-white/10" />
          {activeTab === "organization" ? (
            <View className="mt-4 gap-4">
              <LabeledIconInput
                icon="briefcase"
                label="Organization name"
                required
                value={profileData.organizationName}
                onChangeText={(v) => setField({ organizationName: v })}
                placeholder="Your organization or company name"
              />

              <View className="-mt-1">
                <Text className="font-playfair text-sm text-neutral-600 dark:text-white">Organization logo</Text>
                <Text className="mt-1 font-playfair text-xs text-neutral-500 dark:text-white/90">
                  PNG or JPG, max 5MB (uploaded above).
                </Text>
              </View>
            </View>
          ) : null}

          {activeTab === "sports" ? (
            <View className="mt-4 gap-4">
              <View className="overflow-visible rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <Text className="font-newsreader-bold text-amber-950 dark:text-white">Sports you organize</Text>
                <Text className="mt-1 font-playfair text-xs text-amber-900/90 dark:text-white/90">
                  Pick sports from the Super Admin catalog and save. Use Sports configuration to set formats and rules for
                  these sports.
                </Text>
                <View className="relative z-10 mt-4 overflow-visible">
                  <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 dark:border-white/10 dark:bg-white/5">
                    <Feather name="search" size={18} color={isDark ? "#e5e7eb" : "#374151"} />
                    {loadingCatalog ? (
                      <ActivityIndicator size="small" color={isDark ? "#e5e7eb" : "#374151"} />
                    ) : (
                      <TextInput
                        value={sportSearchQuery}
                        onChangeText={setSportSearchQuery}
                        placeholder="Search catalog to add a sport..."
                        placeholderTextColor={ph}
                        className="flex-1 text-base text-neutral-900 dark:text-white"
                      />
                    )}
                  </View>
                  {!loadingCatalog && sportSearchQuery.trim().length > 0 ? (
                    sportSearchSuggestions.length > 0 ? (
                      <View className="z-50 mt-1 max-h-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-white/20 dark:bg-[#162042] dark:shadow-none">
                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {sportSearchSuggestions.map((s) => (
                            <Pressable
                              key={String(s._id)}
                              onPress={() => handlePickOrganizerSport(s._id, s)}
                              className="border-b border-neutral-100 bg-white px-4 py-3 active:bg-neutral-50 dark:border-white/10 dark:bg-[#162042] dark:active:bg-white/10"
                            >
                              <Text className="font-playfair text-base text-neutral-900 dark:text-white">{s.name}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : (
                      <Text className="mt-2 font-playfair text-sm text-neutral-500 dark:text-white">No matches</Text>
                    )
                  ) : null}
                </View>

                {organizerSportIds.length > 0 ? (
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {organizerSportIds.map((id) => (
                      <View
                        key={id}
                        className="flex-row items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 dark:border-orange-700 dark:bg-orange-900/30"
                      >
                        <Text className="text-xs font-playfair text-orange-900 dark:text-white">
                          {organizerSportLabels[id] || id}
                        </Text>
                        <Pressable onPress={() => removeOrganizerSportChip(id)} hitSlop={8}>
                          <Feather name="x" size={14} color={isDark ? "#fecaca" : "#c2410c"} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white">No sports selected yet.</Text>
                )}

                <Pressable
                  onPress={saveOrganizerSportsOnly}
                  disabled={savingOrganizerSports}
                  className="mt-5 items-center rounded-2xl border border-neutral-200 py-3 dark:border-white/15"
                >
                  {savingOrganizerSports ? (
                    <ActivityIndicator color={isDark ? "#fff" : "#111827"} />
                  ) : (
                    <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Save sports</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === "address" ? (
            <View className="mt-4 gap-4">
              <LabeledIconInput icon="map-pin" label="Street" value={profileData.street} onChangeText={(v) => setField({ street: v })} />
              <LabeledIconInput icon="map-pin" label="City" value={profileData.city} onChangeText={(v) => setField({ city: v })} />
              <LabeledIconInput icon="map" label="State" value={profileData.state} onChangeText={(v) => setField({ state: v })} />
              <LabeledIconInput icon="globe" label="Country" value={profileData.country} onChangeText={(v) => setField({ country: v })} />
              <LabeledIconInput icon="hash" label="Zip code" value={profileData.zipCode} onChangeText={(v) => setField({ zipCode: v })} keyboardType="number-pad" />
            </View>
          ) : null}

          {activeTab === "social" ? (
            <View className="mt-4 gap-4">
              <Text className="font-playfair text-xs text-neutral-500 dark:text-white">
                Public links for your organization (full URLs recommended).
              </Text>
              <LabeledIconInput icon="link" label="Facebook" value={profileData.facebook} onChangeText={(v) => setField({ facebook: v })} autoCapitalize="none" />
              <LabeledIconInput icon="link" label="Twitter / X" value={profileData.twitter} onChangeText={(v) => setField({ twitter: v })} autoCapitalize="none" />
              <LabeledIconInput icon="link" label="Instagram" value={profileData.instagram} onChangeText={(v) => setField({ instagram: v })} autoCapitalize="none" />
              <LabeledIconInput icon="link" label="LinkedIn" value={profileData.linkedin} onChangeText={(v) => setField({ linkedin: v })} autoCapitalize="none" />
            </View>
          ) : null}

          <View className="mt-5">
            <PrimaryButton title="Save organization details" isLoading={savingOrgDetails} onPress={saveOrganizationDetails} />
          </View>
        </View>

        <Pressable
          onPress={() => {
            Alert.alert("Sign out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: async () => {
                  try {
                    await authService.logout();
                  } catch {
                    /* ignore */
                  }
                  dispatch(logout());
                },
              },
            ]);
          }}
          className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10"
        >
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text className="font-newsreader-bold text-red-600">Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
