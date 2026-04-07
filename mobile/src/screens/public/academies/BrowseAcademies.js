import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../../components/AppHeaderBar";
import { SCREENS } from "../../../constants/navigation";
import academyService from "../../../services/academyService";
import sportService from "../../../services/sportService";
import { selectIsAuthenticated, selectUser } from "../../../store/slices/authSlice";
import { excludeOwnAcademyProfiles, shouldHideOwnProfilesInDiscovery } from "../../../utils/discoveryVisibility";
import { formatAcademyNameWithCreator, getErrorMessage } from "../../../utils/helpers";
import { publicEntityId } from "../../../utils/publicProfileView";
import { toast } from "../../../utils/toast";

const HERO = require("../../../../assets/public/bento_academy_bg.png");

function sportOfferedLabel(sport) {
  if (sport == null || sport === "") return "";
  if (typeof sport === "object") return sport.name || sport.slug || sport.title || "";
  return String(sport);
}

export default function BrowseAcademies() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  const [loading, setLoading] = useState(true);
  const [academies, setAcademies] = useState([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [sportOptions, setSportOptions] = useState([]);

  useEffect(() => {
    sportService
      .getCoachingSportsList()
      .then((res) => {
        const list = res?.data || res || [];
        setSportOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => setSportOptions([]));
  }, []);

  const fetchAcademies = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (sportFilter !== "all") params.sport = sportFilter;
      if (cityFilter !== "all") params.city = cityFilter;
      const response = await academyService.getPublicAcademies(params);
      const list = response?.data?.data ?? response?.data?.academies ?? response?.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      setAcademies(
        shouldHideOwnProfilesInDiscovery(isAuthenticated, user) ? excludeOwnAcademyProfiles(arr, user) : arr
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
      setAcademies([]);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, sportFilter, isAuthenticated, user]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  const filteredAcademies = useMemo(() => {
    const term = search.toLowerCase();
    return academies.filter((academy) => {
      const city = academy.address?.city ?? academy.city ?? "";
      const state = academy.address?.state ?? academy.state ?? "";
      const sportsText = (Array.isArray(academy.sportsOffered) ? academy.sportsOffered : [])
        .map((s) => sportOfferedLabel(s))
        .join(" ")
        .toLowerCase();
      return (
        academy.name?.toLowerCase().includes(term) ||
        String(city).toLowerCase().includes(term) ||
        String(state).toLowerCase().includes(term) ||
        academy.description?.toLowerCase().includes(term) ||
        sportsText.includes(term)
      );
    });
  }, [academies, search]);

  const cities = useMemo(
    () => [...new Set(academies.map((a) => a.address?.city ?? a.city).filter(Boolean))],
    [academies]
  );

  const openAcademy = (academy) => {
    const aid = publicEntityId(academy);
    if (!aid) return;
    navigation.navigate(SCREENS.AcademyScreen, { academyId: aid });
  };

  const renderItem = ({ item: academy }) => {
    const title = formatAcademyNameWithCreator(academy);
    return (
      <Pressable
        onPress={() => openAcademy(academy)}
        className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
      >
        <View className="h-48 bg-indigo-900/30">
          {academy.logo ? (
            <Image source={{ uri: academy.logo }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <ImageBackground source={HERO} className="h-full w-full items-center justify-center" resizeMode="cover">
              <View className="absolute inset-0 bg-indigo-900/45" />
              <View className="h-20 w-20 items-center justify-center rounded-full bg-white/20">
                <Text className="text-3xl font-newsreader-bold text-white">{(academy.name || "?").charAt(0)}</Text>
              </View>
            </ImageBackground>
          )}
          <View className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 dark:bg-white/20">
            <Text className="text-xs font-playfair font-semibold text-indigo-600 dark:text-white">
              {academy.totalCourts ?? 0} Courts
            </Text>
          </View>
        </View>
        <View className="p-5">
          <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
            {title}
          </Text>
          {academy.description ? (
            <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/65" numberOfLines={2}>
              {academy.description}
            </Text>
          ) : null}
          <View className="mt-2 gap-1">
            <View className="flex-row items-center gap-2">
              <Feather name="map-pin" size={14} color="rgba(31,43,85,0.75)" />
              <Text className="flex-1 text-sm font-playfair text-neutral-700 dark:text-white/75" numberOfLines={1}>
                {[academy.address?.city ?? academy.city, academy.address?.state ?? academy.state]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Text>
            </View>
            {academy.totalCoaches > 0 ? (
              <View className="flex-row items-center gap-2">
                <Feather name="users" size={14} color="rgba(31,43,85,0.75)" />
                <Text className="text-sm font-playfair text-neutral-700 dark:text-white/75">
                  {academy.totalCoaches} Expert Coaches
                </Text>
              </View>
            ) : null}
          </View>
          {Array.isArray(academy.sportsOffered) && academy.sportsOffered.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {academy.sportsOffered.slice(0, 3).map((sport, index) => (
                <View
                  key={typeof sport === "object" && sport?._id ? sport._id : `sp-${index}`}
                  className="rounded-md bg-indigo-50 px-2 py-1 dark:bg-indigo-900/25"
                >
                  <Text className="text-xs font-playfair font-semibold text-indigo-800 dark:text-indigo-200">
                    {sportOfferedLabel(sport) || "Sport"}
                  </Text>
                </View>
              ))}
              {academy.sportsOffered.length > 3 ? (
                <View className="rounded-md bg-neutral-100 px-2 py-1 dark:bg-white/10">
                  <Text className="text-xs font-playfair font-semibold text-neutral-600 dark:text-white/70">
                    +{academy.sportsOffered.length - 3}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View className="mt-4 rounded-lg bg-indigo-50 py-2.5 dark:bg-indigo-900/20">
            <Text className="text-center text-sm font-playfair font-semibold text-indigo-600 dark:text-indigo-300">
              View Details
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const listHeader = (
    <View>
      <View className="mb-4 overflow-hidden rounded-2xl">
        <ImageBackground source={HERO} className="min-h-[130px] justify-end px-4 pb-4 pt-6" resizeMode="cover">
          <View className="rounded-xl bg-black/45 px-3 py-2">
            <Text className="text-center text-xl font-newsreader-bold text-white">Discover Sports Academies</Text>
            <Text className="mt-1 text-center text-sm font-playfair text-white/90">
              Train, learn, and excel in your favorite sport
            </Text>
          </View>
        </ImageBackground>
      </View>

      <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
        <View className="flex-row items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 dark:border-white/10 dark:bg-white/5">
          <Feather name="search" size={18} color="rgba(17,24,39,0.45)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search academies..."
            placeholderTextColor="rgba(17,24,39,0.35)"
            className="flex-1 py-2.5 text-base text-neutral-900 dark:text-white"
          />
        </View>
        <Text className="mb-2 mt-3 text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => setCityFilter("all")}
            className={`rounded-full px-3 py-2 ${cityFilter === "all" ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
          >
            <Text
              className={`text-xs font-newsreader-bold ${cityFilter === "all" ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
            >
              All cities
            </Text>
          </Pressable>
          {cities.map((city) => (
            <Pressable
              key={city}
              onPress={() => setCityFilter(city)}
              className={`rounded-full px-3 py-2 ${cityFilter === city ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
            >
              <Text
                className={`text-xs font-newsreader-bold ${cityFilter === city ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
              >
                {city}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text className="mb-2 mt-3 text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">Sport</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => setSportFilter("all")}
            className={`rounded-full px-3 py-2 ${sportFilter === "all" ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
          >
            <Text
              className={`text-xs font-newsreader-bold ${sportFilter === "all" ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
            >
              All sports
            </Text>
          </Pressable>
          {sportOptions.map((s) => (
            <Pressable
              key={s._id || s.slug || s.name}
              onPress={() => setSportFilter(s._id)}
              className={`rounded-full px-3 py-2 ${sportFilter === s._id ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
            >
              <Text
                className={`text-xs font-newsreader-bold ${sportFilter === s._id ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
              >
                {typeof s.name === "string" ? s.name : sportOfferedLabel(s)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text className="mb-3 text-lg font-newsreader-bold text-neutral-900 dark:text-white">
        {filteredAcademies.length} {filteredAcademies.length === 1 ? "academy" : "academies"}
      </Text>
    </View>
  );

  if (loading && academies.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar title="Academy" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Academy" />
      <FlatList
        data={filteredAcademies}
        keyExtractor={(item, index) => publicEntityId(item) || `a-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-neutral-200 bg-white py-12 dark:border-white/10 dark:bg-white/5">
            <Feather name="map" size={48} color="rgba(255,255,255,0.25)" />
            <Text className="mt-4 font-newsreader-bold text-neutral-900 dark:text-white">No academies found</Text>
            <Text className="mt-1 px-6 text-center font-playfair text-neutral-600 dark:text-white/65">
              Try adjusting search or filters
            </Text>
          </View>
        }
      />
    </View>
  );
}
