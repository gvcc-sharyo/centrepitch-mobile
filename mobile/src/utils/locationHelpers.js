/**
 * Extract area, city, and state from an expo-location reverse geocode result.
 * Field meaning varies by platform; we follow Expo's LocationGeocodedAddress fields.
 *
 * - state → region (province / state)
 * - city → city, with fallbacks when the platform omits city
 * - area → district (often suburb/area in many regions), then name, then street
 */
export function parseGeocodeParts(place) {
  if (!place) {
    return { area: "", city: "", state: "" };
  }

  const state = String(place.region || "").trim();

  let city = String(place.city || "").trim();
  if (!city) {
    city = String(place.subregion || "").trim();
  }

  let area = String(place.district || "").trim();
  if (!area) {
    area = String(place.name || "").trim();
  }
  if (!area && place.street) {
    area = String(place.street).trim();
  }

  if (area && city && area.toLowerCase() === city.toLowerCase()) {
    area = "";
  }
  if (area && state && area.toLowerCase() === state.toLowerCase()) {
    area = "";
  }

  return { area, city, state };
}

/** Single line for headers: "Area, City, State" (omits empty segments). */
export function buildLocationDisplayLabel(parts) {
  if (!parts) return "";
  const { area, city, state } = parts;
  const bits = [area, city, state].map((x) => String(x || "").trim()).filter(Boolean);
  return bits.join(", ");
}

/** @deprecated Use buildLocationDisplayLabel(parseGeocodeParts(place)) */
export function formatGeocodeLabel(place) {
  return buildLocationDisplayLabel(parseGeocodeParts(place));
}

export const DEFAULT_MAP_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};
