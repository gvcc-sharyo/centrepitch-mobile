import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../../components/AppHeaderBar";
import { SCREENS } from "../../../constants/navigation";
import academyService from "../../../services/academyService";
import { selectIsAuthenticated, selectUser } from "../../../store/slices/authSlice";
import { formatAcademyNameWithCreator, getErrorMessage } from "../../../utils/helpers";
import { publicEntityId } from "../../../utils/publicProfileView";
import { toast } from "../../../utils/toast";

const HERO = require("../../../../assets/public/bento_academy_bg.png");

function formatAddressLine(academy) {
  const a = academy?.address;
  if (a && typeof a === "object") {
    const parts = [a.street, a.city, a.state, a.pincode, a.country].filter(
      (x) => x != null && String(x).trim() !== ""
    );
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

function sportLabel(s) {
  if (s == null) return "";
  if (typeof s === "object") return s.name || s.slug || "";
  return String(s);
}

function formatFacility(f) {
  const raw = String(f || "");
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function coachSpecializationLine(coach) {
  const spec = coach?.specialization;
  if (Array.isArray(spec)) {
    const line = spec
      .map((x) => (typeof x === "object" && x != null ? x.name : x))
      .filter(Boolean)
      .join(", ");
    return line || "Coach";
  }
  return spec ? String(spec) : "Coach";
}

const looksLikeObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || "").trim());
const normalizeDocId = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object" && value !== null && value._id != null) return String(value._id);
  return String(value);
};

function courtSportLabel(court, academySports = []) {
  const names = new Set();
  const addName = (value) => {
    const label = String(value || "").trim();
    if (!label || looksLikeObjectId(label)) return;
    names.add(label);
  };

  if (Array.isArray(court?.sportTypes)) {
    court.sportTypes.forEach((s) => addName(typeof s === "object" ? s?.name || s?.slug : s));
  }

  const single = court?.sportType;
  if (single && typeof single === "object") {
    addName(single?.name || single?.slug);
  } else {
    addName(single);
  }

  const sportIds = [
    normalizeDocId(single),
    ...(Array.isArray(court?.sportTypes) ? court.sportTypes.map((s) => normalizeDocId(s)) : []),
  ].filter((id) => id && looksLikeObjectId(id));
  if (sportIds.length > 0) {
    sportIds.forEach((id) => {
      const match = (Array.isArray(academySports) ? academySports : []).find(
        (s) => normalizeDocId(s?._id) === id
      );
      addName(match?.name || match?.slug);
    });
  }

  if (names.size === 0) {
    const courtNameLower = String(court?.name || "").toLowerCase();
    (Array.isArray(academySports) ? academySports : []).forEach((s) => {
      const n = String(s?.name || "").trim().toLowerCase();
      if (n && courtNameLower.includes(n)) addName(s?.name);
    });
  }

  return names.size > 0 ? Array.from(names).join(", ") : "Sport";
}

function getCourtPrice(court) {
  const rawPrice =
    court?.pricing?.hourlyRate ??
    court?.pricePerHour ??
    court?.hourlyRate ??
    court?.price ??
    null;
  const amount = Number(rawPrice);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function SectionCard({ title, children }) {
  return (
    <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <Text className="mb-3 text-lg font-newsreader-bold text-neutral-900 dark:text-white">{title}</Text>
      {children}
    </View>
  );
}

export default function AcademyPage() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const academyId = route.params?.academyId;

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const isPlayer = isAuthenticated && String(user?.role || "").toLowerCase() === "player";

  const [loading, setLoading] = useState(true);
  const [academy, setAcademy] = useState(null);
  const [courts, setCourts] = useState([]);
  const [coaches, setCoaches] = useState([]);

  const load = useCallback(async () => {
    if (!academyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await academyService.getPublicAcademyById(academyId);
      const data = res?.data?.data ?? res?.data;
      if (!data) {
        setAcademy(null);
        setCourts([]);
        setCoaches([]);
        return;
      }
      setAcademy(data);
      setCourts(Array.isArray(data.courts) ? data.courts : []);
      setCoaches(Array.isArray(data.coaches) ? data.coaches : []);
    } catch (e) {
      const status = e?.response?.status;
      if (status !== 404) toast.error(getErrorMessage(e));
      setAcademy(null);
      setCourts([]);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  const addressLine = academy ? formatAddressLine(academy) : null;
  const contactEmail = academy?.email || academy?.contactEmail;
  const contactPhone = academy?.phone || academy?.contactPhone;
  const sportsList = useMemo(
    () => (academy?.sportsOffered || []).map(sportLabel).filter(Boolean),
    [academy?.sportsOffered]
  );
  const isApproved = academy && String(academy.status || "").toUpperCase() === "APPROVED";
  const totalCourts = Number(academy?.totalCourts ?? courts.length ?? 0);
  const totalCoaches = Number(academy?.totalCoaches ?? coaches.length ?? 0);

  const displayTitle = academy ? formatAcademyNameWithCreator(academy) : "Academy";

  const goPlayerDashboard = () => {
    navigation.navigate("RoleRoot", { screen: SCREENS.Dashboard });
  };

  const openCourt = (court) => {
    if (!court?._id) return;
    navigation.navigate(SCREENS.CourtScreen, { courtId: court._id });
  };

  const openCoach = (coach) => {
    const coachId = publicEntityId(coach);
    if (!coachId) return;
    navigation.navigate(SCREENS.CoachScreen, { coachId });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar title="Academy" />
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      </View>
    );
  }

  if (!academy) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar title="Academy" />
        <View className="flex-1 items-center justify-center px-6">
          <Feather name="book-open" size={48} color="rgba(255,255,255,0.35)" />
          <Text className="mt-4 text-center font-newsreader-bold text-neutral-900 dark:text-white">
            {academyId ? "Academy not found" : "Missing academy id"}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            className="mt-6 rounded-2xl bg-primary px-6 py-3"
          >
            <Text className="font-newsreader-bold text-white">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title={displayTitle} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 8,
          paddingHorizontal: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          className="mb-4 flex-row items-center gap-2 self-start py-1"
        >
          <Feather name="arrow-left" size={18} color="#0A763A" />
          <Text className="text-sm font-playfair font-semibold text-primary">Back to academies</Text>
        </Pressable>

        <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5">
          <View className="h-40 bg-indigo-900/20">
            {academy.logo ? (
              <Image source={{ uri: academy.logo }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <ImageBackground source={HERO} className="h-full w-full items-center justify-center" resizeMode="cover">
                <View className="absolute inset-0 bg-indigo-900/50" />
                <Text className="text-5xl font-newsreader-bold text-white">
                  {(academy.name || "A").charAt(0).toUpperCase()}
                </Text>
              </ImageBackground>
            )}
          </View>
          <View className="p-5">
            <View className="flex-row gap-4">
              <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-white/15 dark:bg-white/10">
                {academy.logo ? (
                  <Image source={{ uri: academy.logo }} className="h-full w-full" resizeMode="contain" />
                ) : (
                  <Text className="text-2xl font-newsreader-bold text-primary">
                    {(academy.name || "A").charAt(0)}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-xl font-newsreader-bold text-neutral-900 dark:text-white">{academy.name}</Text>
                {academy.description ? (
                  <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70" numberOfLines={4}>
                    {academy.description}
                  </Text>
                ) : null}
                <View className="mt-3 gap-2">
                  {addressLine ? (
                    <View className="flex-row items-start gap-2">
                      <Feather name="map-pin" size={14} color="rgba(31,43,85,0.75)" />
                      <Text className="flex-1 text-xs font-playfair text-neutral-700 dark:text-white/75">{addressLine}</Text>
                    </View>
                  ) : null}
                  {academy.establishedYear ? (
                    <View className="flex-row items-center gap-2">
                      <Feather name="calendar" size={14} color="rgba(31,43,85,0.75)" />
                      <Text className="text-xs font-playfair text-neutral-700 dark:text-white/75">
                        Since {academy.establishedYear}
                      </Text>
                    </View>
                  ) : null}
                  {isApproved ? (
                    <View className="flex-row items-center gap-2">
                      <Feather name="check-circle" size={14} color="#059669" />
                      <Text className="text-xs font-playfair font-semibold text-emerald-700 dark:text-emerald-300">
                        Verified academy
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </View>

        <SectionCard title="About">
          <Text className="text-sm font-playfair leading-6 text-neutral-700 dark:text-white/75">
            {academy.description || "No description available."}
          </Text>
        </SectionCard>

        {sportsList.length > 0 ? (
          <SectionCard title="Sports offered">
            <View className="flex-row flex-wrap gap-2">
              {sportsList.map((name, index) => (
                <View key={index} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 dark:bg-emerald-900/25">
                  <Text className="text-sm font-playfair font-semibold text-emerald-800 dark:text-emerald-200">{name}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {Array.isArray(academy.facilities) && academy.facilities.length > 0 ? (
          <SectionCard title="Facilities">
            <View className="gap-2">
              {academy.facilities.map((facility, index) => (
                <View
                  key={index}
                  className="flex-row items-center gap-2 rounded-xl bg-neutral-50 p-3 dark:bg-white/5"
                >
                  <Feather name="check-circle" size={16} color="#059669" />
                  <Text className="flex-1 text-sm font-playfair text-neutral-800 dark:text-white/85">
                    {formatFacility(facility)}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {courts.length > 0 ? (
          <SectionCard title="Courts">
            <View className="gap-3">
              {courts.map((court) => {
                const price = getCourtPrice(court);
                return (
                  <Pressable
                    key={court._id}
                    onPress={() => openCourt(court)}
                    className="rounded-xl border border-neutral-200 p-4 dark:border-white/15"
                  >
                    <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{court.name}</Text>
                    <Text className="mt-1 text-xs font-playfair text-neutral-500 dark:text-white/55">
                      {courtSportLabel(court, academy?.sportsOffered)}
                    </Text>
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="flex-1 text-sm font-playfair text-neutral-600 dark:text-white/65" numberOfLines={1}>
                        {academy?.name}
                      </Text>
                      <Text className="font-newsreader-bold text-emerald-600 dark:text-emerald-400">
                        {price ? `₹${price}/hr` : "—"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        ) : null}

        {coaches.length > 0 ? (
          <SectionCard title="Coaches">
            <View className="gap-3">
              {coaches.map((coach) => {
                const fn = coach.firstName || "";
                const ln = coach.lastName || "";
                const label = `${fn} ${ln}`.trim() || "Coach";
                const initials = `${fn.charAt(0) || "?"}${ln.charAt(0) || ""}`.toUpperCase();
                const cid = publicEntityId(coach);
                return (
                  <Pressable
                    key={cid || label}
                    onPress={() => openCoach(coach)}
                    disabled={!cid}
                    className="flex-row items-center gap-3 rounded-xl border border-neutral-200 p-3 opacity-100 disabled:opacity-50 dark:border-white/15"
                  >
                    <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-700">
                      {coach.profilePhoto ? (
                        <Image source={{ uri: coach.profilePhoto }} className="h-full w-full" resizeMode="cover" />
                      ) : (
                        <Text className="font-newsreader-bold text-white">{initials}</Text>
                      )}
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="font-playfair font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>
                        {label}
                      </Text>
                      <Text className="text-sm font-playfair text-neutral-500 dark:text-white/55" numberOfLines={1}>
                        {coachSpecializationLine(coach)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(31,43,85,0.45)" />
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        ) : null}

        <SectionCard title="Contact">
          <View className="gap-3">
            {addressLine ? (
              <View className="flex-row items-start gap-3">
                <Feather name="map-pin" size={18} color="rgba(31,43,85,0.55)" />
                <Text className="flex-1 text-sm font-playfair text-neutral-700 dark:text-white/75">{addressLine}</Text>
              </View>
            ) : null}
            {contactEmail ? (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${contactEmail}`)}
                className="flex-row items-center gap-3"
              >
                <Feather name="mail" size={18} color="rgba(31,43,85,0.55)" />
                <Text className="flex-1 text-sm font-playfair font-semibold text-primary">{contactEmail}</Text>
              </Pressable>
            ) : null}
            {contactPhone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${contactPhone}`)} className="flex-row items-center gap-3">
                <Feather name="phone" size={18} color="rgba(31,43,85,0.55)" />
                <Text className="text-sm font-playfair font-semibold text-primary">{contactPhone}</Text>
              </Pressable>
            ) : null}
            {academy.website ? (
              <Pressable
                onPress={() => Linking.openURL(academy.website.startsWith("http") ? academy.website : `https://${academy.website}`)}
                className="flex-row items-center gap-3"
              >
                <Feather name="globe" size={18} color="rgba(31,43,85,0.55)" />
                <Text className="text-sm font-playfair font-semibold text-primary">Website</Text>
              </Pressable>
            ) : null}
          </View>
        </SectionCard>

        {!isAuthenticated ? (
          <View className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
            <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">Sign in</Text>
            <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
              Sign in as a player to join academies, book courts, and more.
            </Text>
            <Pressable
              onPress={() => toast.info("Use Logout in Profile, then sign in from the welcome screen.")}
              className="mt-4 h-11 items-center justify-center rounded-xl bg-primary"
            >
              <Text className="font-newsreader-bold text-white">How to sign in</Text>
            </Pressable>
          </View>
        ) : null}

        {isAuthenticated && isPlayer ? (
          <View className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
                <Feather name="user" size={20} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white">You&apos;re signed in</Text>
                <Text className="text-sm font-playfair text-neutral-600 dark:text-white/70">
                  Explore this academy or open your dashboard.
                </Text>
              </View>
            </View>
            <View className="mt-4 gap-3">
              <Pressable
                onPress={() => {
                  toast.success("Find the join flow in a future app update — browse courts and coaches above.");
                }}
                className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600"
              >
                <Feather name="send" size={18} color="#fff" />
                <Text className="font-newsreader-bold text-white">Join academy</Text>
              </Pressable>
              <Pressable
                onPress={goPlayerDashboard}
                className="h-12 items-center justify-center rounded-xl border-2 border-emerald-600"
              >
                <Text className="font-newsreader-bold text-emerald-700 dark:text-emerald-300">Player dashboard</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isAuthenticated && !isPlayer ? (
          <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 dark:border-amber-900/40 dark:bg-amber-950/25">
            <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">Player account needed</Text>
            <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
              Use a player account to join or book at this academy.
            </Text>
          </View>
        ) : null}

        <View className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/90 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/25">
          <Text className="mb-3 text-lg font-newsreader-bold text-neutral-900 dark:text-white">Quick stats</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">Courts</Text>
              <Text className="font-newsreader-bold text-emerald-700 dark:text-emerald-300">{totalCourts}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">Coaches</Text>
              <Text className="font-newsreader-bold text-emerald-700 dark:text-emerald-300">{totalCoaches}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">Sports</Text>
              <Text className="font-newsreader-bold text-emerald-700 dark:text-emerald-300">{sportsList.length}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
