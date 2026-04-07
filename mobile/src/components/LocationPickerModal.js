import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import {
  closeLocationPicker,
  selectLastGps,
  selectLocation,
  selectLocationPickerOpen,
  selectTheme,
  setLocation,
} from "../store/slices/uiSlice";
import {
  DEFAULT_MAP_REGION,
  buildLocationDisplayLabel,
  parseGeocodeParts,
} from "../utils/locationHelpers";
import { toast } from "../utils/toast";
import LocationMapEmbed from "./LocationMapEmbed";

function regionAround(lat, lng) {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
}

export default function LocationPickerModal() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const open = useSelector(selectLocationPickerOpen);
  const stored = useSelector(selectLocation);
  const lastGps = useSelector(selectLastGps);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";

  const [manualLabel, setManualLabel] = useState("");
  const [marker, setMarker] = useState({
    latitude: DEFAULT_MAP_REGION.latitude,
    longitude: DEFAULT_MAP_REGION.longitude,
  });
  const [mapRegion, setMapRegion] = useState(DEFAULT_MAP_REGION);
  const [mapTouched, setMapTouched] = useState(false);
  const [usedGpsButton, setUsedGpsButton] = useState(false);
  const [locating, setLocating] = useState(false);

  const resetFromStore = useCallback(() => {
    const lat = stored?.latitude ?? lastGps?.latitude ?? DEFAULT_MAP_REGION.latitude;
    const lng = stored?.longitude ?? lastGps?.longitude ?? DEFAULT_MAP_REGION.longitude;
    const m = { latitude: lat, longitude: lng };
    setMarker(m);
    setMapRegion(regionAround(lat, lng));
    const fromGpsParts =
      lastGps?.area || lastGps?.city || lastGps?.state
        ? buildLocationDisplayLabel({
            area: lastGps?.area,
            city: lastGps?.city,
            state: lastGps?.state,
          })
        : "";
    setManualLabel(
      stored?.label || stored?.addressLine || lastGps?.label || fromGpsParts || ""
    );
    setMapTouched(false);
    setUsedGpsButton(false);
  }, [stored, lastGps]);

  useEffect(() => {
    if (open) resetFromStore();
  }, [open, resetFromStore]);

  const onPressMap = useCallback((e) => {
    if (Platform.OS === "web") return;
    const c = e?.nativeEvent?.coordinate;
    if (!c) return;
    setMapTouched(true);
    setMarker(c);
    setMapRegion(regionAround(c.latitude, c.longitude));
  }, []);

  const onMarkerDragEnd = useCallback((c) => {
    if (!c) return;
    setMapTouched(true);
    setMarker(c);
    setMapRegion(regionAround(c.latitude, c.longitude));
  }, []);

  const useDeviceLocation = useCallback(async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.error("Location permission is required to use your position.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMapTouched(true);
      setUsedGpsButton(true);
      setMarker(c);
      setMapRegion(regionAround(c.latitude, c.longitude));
      const [place] = await Location.reverseGeocodeAsync(c);
      const parts = parseGeocodeParts(place);
      const label = buildLocationDisplayLabel(parts);
      if (label) setManualLabel(label);
    } catch (e) {
      toast.error("Could not read GPS. Try entering your area manually.");
    } finally {
      setLocating(false);
    }
  }, []);

  const save = useCallback(async () => {
    const label = manualLabel.trim();
    const pinFromSession = mapTouched || usedGpsButton;
    let lat = pinFromSession ? marker.latitude : stored?.latitude ?? null;
    let lng = pinFromSession ? marker.longitude : stored?.longitude ?? null;

    if (!label && (lat == null || lng == null)) {
      toast.error("Enter a location or pick a point on the map.");
      return;
    }

    let parts = {
      area: stored?.area || "",
      city: stored?.city || "",
      state: stored?.state || "",
    };

    if (lat != null && lng != null) {
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        parts = parseGeocodeParts(place);
      } catch {
        /* keep previous parts */
      }
    }

    const structured = buildLocationDisplayLabel(parts);
    let finalLabel = structured;
    if (!finalLabel && label.trim()) {
      finalLabel = label.trim();
    }
    if (!finalLabel && lat != null && lng != null) {
      finalLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    let source = "manual";
    if (usedGpsButton && !mapTouched) source = "gps";
    else if (mapTouched) source = "map";
    else if (stored?.source) source = stored.source;

    dispatch(
      setLocation({
        latitude: lat ?? null,
        longitude: lng ?? null,
        label: finalLabel || "Selected location",
        addressLine: structured || finalLabel || "",
        area: parts.area || "",
        city: parts.city || "",
        state: parts.state || "",
        source,
      })
    );
    dispatch(closeLocationPicker());
  }, [dispatch, manualLabel, mapTouched, marker, stored, usedGpsButton]);

  const mapProps = useMemo(
    () => ({
      region: mapRegion,
      marker,
      onPressMap,
      onMarkerDragEnd: onMarkerDragEnd,
    }),
    [mapRegion, marker, onPressMap, onMarkerDragEnd]
  );

  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => dispatch(closeLocationPicker())}>
      <KeyboardAvoidingView
        className="flex-1 bg-white dark:bg-[#1F2B55]"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <Pressable
            onPress={() => dispatch(closeLocationPicker())}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Feather name="x" size={22} color={isDark ? "#F9FAFB" : "#111827"} />
          </Pressable>
          <Text className="text-base font-playfair font-semibold text-neutral-900 dark:text-white">location</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-2 text-sm font-playfair text-neutral-600 dark:text-white/70">
            Tap the map or use GPS — we fill area, city, and state from the map position. You can edit the text below if needed.
          </Text>

          <LocationMapEmbed {...mapProps} />

          <Text className="mb-1 mt-4 text-xs font-playfair font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/55">
            Area, city, state (editable)
          </Text>
          <TextInput
            value={manualLabel}
            onChangeText={setManualLabel}
            placeholder="e.g. Nugegoda, Colombo, Western Province"
            placeholderTextColor={isDark ? "rgba(255,255,255,0.35)" : "rgba(17,24,39,0.35)"}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
          />

          <Pressable
            onPress={useDeviceLocation}
            disabled={locating}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 py-3 dark:bg-primary/20"
          >
            {locating ? (
              <ActivityIndicator color={isDark ? "#fff" : "#1F2B55"} />
            ) : (
              <Feather name="navigation" size={18} color={isDark ? "#93C5FD" : "#1F2B55"} />
            )}
            <Text className="font-playfair font-semibold text-primary dark:text-sky-300">Use current GPS location</Text>
          </Pressable>

          <Pressable
            onPress={save}
            className="mt-6 rounded-xl bg-primary py-3.5 dark:bg-sky-600"
          >
            <Text className="text-center font-playfair font-semibold text-white">Save location</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
