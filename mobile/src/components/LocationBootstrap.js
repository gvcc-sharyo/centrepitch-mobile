import { useEffect } from "react";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";

import { store } from "../store/store";
import { setLastGps, setLocation } from "../store/slices/uiSlice";
import { buildLocationDisplayLabel, parseGeocodeParts } from "../utils/locationHelpers";

/**
 * On app launch, requests permission and reads GPS. Updates persisted `location`
 * when the user has not chosen a manual/map pin (only empty or GPS-sourced).
 */
export default function LocationBootstrap() {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const [place] = await Location.reverseGeocodeAsync(coords);
        const parts = parseGeocodeParts(place);
        const label = buildLocationDisplayLabel(parts);
        const fallbackCoords = `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
        dispatch(
          setLastGps({
            ...coords,
            label: label || fallbackCoords,
            area: parts.area,
            city: parts.city,
            state: parts.state,
            updatedAt: Date.now(),
          })
        );

        const loc = store.getState().ui.location;
        const shouldFillFromGps =
          !loc?.label?.trim() || loc.source === "gps" || !loc.source;
        if (shouldFillFromGps) {
          dispatch(
            setLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              label: label || fallbackCoords,
              addressLine: label || "",
              area: parts.area || "",
              city: parts.city || "",
              state: parts.state || "",
              source: "gps",
            })
          );
        }
      } catch {
        // GPS unavailable or denied after prompt — keep stored location
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}
