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

import AppHeaderBar from "../../../components/AppHeaderBar";
import { SCREENS } from "../../../constants/navigation";
import courtService from "../../../services/courtService";
import sportService from "../../../services/sportService";
import { formatCurrency, getErrorMessage } from "../../../utils/helpers";
import { toast } from "../../../utils/toast";

const HERO = require("../../../../assets/public/bento_academy_bg.png");

function courtPrimaryImage(court) {
  const imgs = Array.isArray(court?.images) ? court.images : [];
  const primary = imgs.find((i) => i?.isPrimary && i?.url);
  if (primary?.url) return primary.url;
  return imgs[0]?.url || null;
}

function sportLabel(court) {
  const st = court?.sportType;
  if (st && typeof st === "object") return st.name || st.slug || "";
  if (Array.isArray(court?.sportTypes) && court.sportTypes.length > 0) {
    const first = court.sportTypes[0];
    if (first && typeof first === "object") return first.name || first.slug || "";
  }
  return "";
}

function courtCity(court) {
  return court?.academy?.address?.city || court?.location?.area || "";
}

export default function BrowseCourts() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState([]);
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

  const fetchCourts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, limit: 100 };
      if (sportFilter !== "all") params.sportType = sportFilter;
      if (cityFilter !== "all") params.city = cityFilter;
      const response = await courtService.getPublicCourts(params);
      const list = response?.data?.data ?? response?.data ?? [];
      setCourts(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, sportFilter]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  const cities = useMemo(
    () => [...new Set(courts.map((c) => courtCity(c)).filter(Boolean))],
    [courts]
  );

  const filteredCourts = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return courts;
    return courts.filter((court) => {
      const name = court.name?.toLowerCase() || "";
      const desc = court.description?.toLowerCase() || "";
      const city = courtCity(court).toLowerCase();
      const academyName = court.academy?.name?.toLowerCase() || "";
      const sport = sportLabel(court).toLowerCase();
      return (
        name.includes(term) ||
        desc.includes(term) ||
        city.includes(term) ||
        academyName.includes(term) ||
        sport.includes(term)
      );
    });
  }, [courts, search]);

  const openCourt = (court) => {
    const id = court?._id;
    if (!id) return;
    navigation.navigate(SCREENS.CourtScreen, { courtId: id });
  };

  const renderItem = ({ item: court }) => {
    const img = courtPrimaryImage(court);
    const city = courtCity(court);
    const sport = sportLabel(court);
    const rate = court.pricing?.hourlyRate;
    const currency = court.pricing?.currency || "INR";

    return (
      <Pressable
        onPress={() => openCourt(court)}
        className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
      >
        <View className="h-44 bg-emerald-900/20">
          {img ? (
            <Image source={{ uri: img }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <ImageBackground source={HERO} className="h-full w-full items-center justify-center" resizeMode="cover">
              <View className="absolute inset-0 bg-[#1F2B55]/50" />
              <View className="h-16 w-16 items-center justify-center rounded-full bg-white/25">
                <Feather name="target" size={32} color="#fff" />
              </View>
            </ImageBackground>
          )}
          {sport ? (
            <View className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 dark:bg-white/20">
              <Text className="text-xs font-playfair font-semibold text-[#1F2B55] dark:text-white">{sport}</Text>
            </View>
          ) : null}
          {typeof court.averageRating === "number" && court.averageRating > 0 ? (
            <View className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full bg-black/55 px-2 py-1">
              <Feather name="star" size={12} color="#FBBF24" />
              <Text className="text-xs font-newsreader-bold text-white">{court.averageRating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <View className="p-4">
          <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white" numberOfLines={2}>
            {court.name}
          </Text>
          {court.academy?.name ? (
            <Text className="mt-0.5 text-sm font-playfair text-neutral-500 dark:text-white/55" numberOfLines={1}>
              {court.academy.name}
            </Text>
          ) : null}
          {court.description ? (
            <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/65" numberOfLines={2}>
              {court.description}
            </Text>
          ) : null}
          <View className="mt-2 gap-1">
            {city ? (
              <View className="flex-row items-center gap-2">
                <Feather name="map-pin" size={14} color="rgba(31,43,85,0.75)" />
                <Text className="flex-1 text-sm font-playfair text-neutral-700 dark:text-white/75" numberOfLines={1}>
                  {city}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Feather name="layers" size={14} color="rgba(31,43,85,0.75)" />
              <Text className="text-sm font-playfair capitalize text-neutral-700 dark:text-white/75">
                {String(court.courtType || "").replace(/_/g, " ").toLowerCase() || "—"}
              </Text>
            </View>
            {typeof rate === "number" && rate >= 0 ? (
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={14} color="rgba(31,43,85,0.75)" />
                <Text className="text-sm font-playfair font-semibold text-neutral-900 dark:text-white">
                  {formatCurrency(rate, currency)}/hr
                </Text>
              </View>
            ) : null}
          </View>
          <View className="mt-3 rounded-lg bg-primary/10 py-2.5 dark:bg-white/10">
            <Text className="text-center text-sm font-playfair font-semibold text-primary dark:text-white">View & book</Text>
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
            <Text className="text-center text-xl font-newsreader-bold text-white">Book a court</Text>
            <Text className="mt-1 text-center text-sm font-playfair text-white/90">
              Browse approved courts and reserve your slot
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
            placeholder="Search courts, city, academy..."
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
                {typeof s.name === "string" ? s.name : String(s)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text className="mb-3 text-lg font-newsreader-bold text-neutral-900 dark:text-white">
        {filteredCourts.length} {filteredCourts.length === 1 ? "court" : "courts"}
      </Text>
    </View>
  );

  if (loading && courts.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-[#1F2B55]">
        <AppHeaderBar title="Book court" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1F2B55" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Book court" />
      <FlatList
        data={filteredCourts}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-neutral-200 bg-white py-12 dark:border-white/10 dark:bg-white/5">
            <Feather name="target" size={48} color="rgba(255,255,255,0.25)" />
            <Text className="mt-4 font-newsreader-bold text-neutral-900 dark:text-white">No courts found</Text>
            <Text className="mt-1 px-6 text-center font-playfair text-neutral-600 dark:text-white/65">
              Try another city, sport, or search term
            </Text>
          </View>
        }
      />
    </View>
  );
}
