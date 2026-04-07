import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import PrimaryButton from "../../components/forms/PrimaryButton";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import { SCREENS } from "../../constants/navigation";
import eventService from "../../services/eventService";
import sportService from "../../services/sportService";
import uploadService from "../../services/uploadService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage, isValidPhone, sanitizePhoneInput } from "../../utils/helpers";
import { toast } from "../../utils/toast";

function buildSportConfig(sportDoc, gameFormat) {
  const tf = sportDoc?.formats?.team || {};
  return {
    formats: {
      individual: {
        enabled: gameFormat === "individual",
        minPlayers: 1,
        maxPlayers: 1,
        description: "",
      },
      doubles: {
        enabled: gameFormat === "doubles",
        minPlayers: 2,
        maxPlayers: 2,
        description: "",
      },
      team: {
        enabled: gameFormat === "team",
        minPlayersPerTeam: tf.minPlayersPerTeam ?? 5,
        maxPlayersPerTeam: tf.maxPlayersPerTeam ?? 15,
        playingCount: tf.playingCount ?? 11,
        substitutesCount: tf.substitutesCount ?? 4,
        description: "",
      },
    },
    teamSettings: {
      requiresCaptain: true,
      requiresViceCaptain: false,
      memberRequiredFields: ["name", "email", "phone"],
      positions: [],
      jerseyNumberRange: { min: 1, max: 99 },
    },
    categories: [],
  };
}

export default function CreateEvent() {
  const navigation = useNavigation();
  const user = useSelector(selectUser);
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [sportDoc, setSportDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [sportId, setSportId] = useState("");
  const [gameFormat, setGameFormat] = useState("team");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("18:00");
  const [regStart, setRegStart] = useState("");
  const [regEnd, setRegEnd] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [zipCode, setZipCode] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [registrationFee, setRegistrationFee] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [bannerImages, setBannerImages] = useState([]);

  const formatOptions = useMemo(() => {
    const f = sportDoc?.formats || {};
    const opts = [];
    if (f.individual?.enabled) opts.push({ value: "individual", label: "Individual" });
    if (f.doubles?.enabled) opts.push({ value: "doubles", label: "Doubles" });
    if (f.team?.enabled) opts.push({ value: "team", label: "Team" });
    return opts.length ? opts : [{ value: "team", label: "Team" }];
  }, [sportDoc]);

  useEffect(() => {
    if (formatOptions.length && !formatOptions.some((o) => o.value === gameFormat)) {
      setGameFormat(formatOptions[0].value);
    }
  }, [formatOptions, gameFormat]);

  const loadSports = useCallback(async () => {
    setLoadingSports(true);
    try {
      const res = await sportService.getSports({ page: 1, limit: 200, isActive: true });
      const rows = res?.data ?? [];
      setSports(Array.isArray(rows) ? rows : []);
    } catch {
      setSports([]);
      toast.error("Could not load sports");
    } finally {
      setLoadingSports(false);
    }
  }, []);

  useEffect(() => {
    loadSports();
  }, [loadSports]);

  const onPickSport = async (id) => {
    setSportId(id);
    if (!id) {
      setSportDoc(null);
      return;
    }
    try {
      const res = await sportService.getSportById(id);
      const doc = res?.data ?? res;
      setSportDoc(doc);
    } catch {
      setSportDoc(null);
      toast.error("Could not load sport details");
    }
  };

  const pickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Photo library permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: "banner.jpg",
        type: "image/jpeg",
      };
      const up = await uploadService.uploadEventImage(file);
      const url = up?.data?.url ?? up?.url;
      if (!url) throw new Error("Upload did not return a URL");
      setBannerImages([url]);
      toast.success("Banner uploaded");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    if (!sportId) {
      toast.error("Select a sport");
      return false;
    }
    if (!name.trim()) {
      toast.error("Event name is required");
      return false;
    }
    if (description.trim().length < 50) {
      toast.error("Description must be at least 50 characters");
      return false;
    }
    if (!startDate || !endDate || !regStart || !regEnd) {
      toast.error("Fill in all dates");
      return false;
    }
    if (!venue.trim() || !city.trim() || !country.trim()) {
      toast.error("Venue, city, and country are required");
      return false;
    }
    if (!contactEmail.trim() || !/\S+@\S+\.\S+/.test(contactEmail)) {
      toast.error("Valid contact email is required");
      return false;
    }
    if (contactPhone?.trim() && !isValidPhone(sanitizePhoneInput(contactPhone))) {
      toast.error("Invalid phone (10 digits, starts with 6–9)");
      return false;
    }
    if (bannerImages.length === 0) {
      toast.error("Add at least one banner image");
      return false;
    }
    return true;
  };

  const submit = async (publish) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const startDateTime = new Date(`${startDate}T${startTime || "00:00"}`);
      const endDateTime = new Date(`${endDate}T${endTime || "23:59"}`);
      const sportConfig = buildSportConfig(sportDoc, gameFormat);
      const eventData = {
        name: name.trim(),
        sport: sportId,
        sportConfig,
        gameFormat,
        category: null,
        description: description.trim(),
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        registrationStartDate: new Date(regStart).toISOString(),
        registrationEndDate: new Date(regEnd).toISOString(),
        location: {
          venue: venue.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          zipCode: zipCode.trim(),
          googleMapsLink: "",
        },
        maxParticipants: maxParticipants.trim() ? parseInt(maxParticipants, 10) : null,
        maxTeams: maxTeams.trim() ? parseInt(maxTeams, 10) : null,
        registrationFee: parseFloat(registrationFee) || 0,
        currency,
        contactDetails: {
          email: contactEmail.trim(),
          phone: sanitizePhoneInput(contactPhone || ""),
        },
        socialMediaLinks: {
          website: "",
          facebook: "",
          twitter: "",
          instagram: "",
          youtube: "",
        },
        keywords: [],
        bannerImages,
        qr_code_image: "",
        isPublished: publish,
        isFeatured: false,
      };
      const response = await eventService.createEvent(eventData);
      const created = response?.data ?? response;
      const id = created?._id ?? created?.id;
      toast.success(publish ? "Event published" : "Draft saved");
      if (id) {
        navigation.replace(SCREENS.EventDetails, { eventId: String(id), organizerMode: true });
      } else {
        navigation.navigate(SCREENS.OrganizerMyEvents);
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <OrganizerScreenShell title="Create event" scrollable={false}>
      {loadingSports ? (
        <View className="py-12 items-center">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">Sport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row gap-2">
            {sports.map((s) => {
              const id = String(s._id || s.id);
              const active = sportId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => onPickSport(id)}
                  className={`mr-2 rounded-2xl border px-4 py-2 ${
                    active ? "border-primary bg-primary/10" : "border-neutral-200 dark:border-white/10"
                  }`}
                >
                  <Text
                    className={`font-playfair text-sm ${active ? "font-semibold text-primary" : "text-neutral-800 dark:text-white/85"}`}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {sportDoc ? (
            <View className="mb-4">
              <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">Format</Text>
              <View className="flex-row flex-wrap gap-2">
                {formatOptions.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => setGameFormat(o.value)}
                    className={`rounded-full px-3 py-2 ${gameFormat === o.value ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
                  >
                    <Text
                      className={`text-xs font-playfair font-semibold ${gameFormat === o.value ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <LabeledIconInput icon="edit-2" label="Event name" value={name} onChangeText={setName} />
          <Text className="mb-1 mt-3 font-playfair text-sm text-neutral-600 dark:text-white/60">Description (50+ chars)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
            placeholderTextColor={ph}
            multiline
            className={`min-h-[100px] ${inputClass}`}
            textAlignVertical="top"
          />

          <Text className="mb-2 mt-4 font-newsreader-bold text-neutral-900 dark:text-white">Schedule</Text>
          <Text className="mb-1 text-xs font-playfair text-neutral-500">Start date (YYYY-MM-DD)</Text>
          <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-05-01" placeholderTextColor={ph} className={inputClass} />
          <Text className="mb-1 mt-2 text-xs font-playfair text-neutral-500">Start time (HH:MM)</Text>
          <TextInput value={startTime} onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={ph} className={inputClass} />
          <Text className="mb-1 mt-2 text-xs font-playfair text-neutral-500">End date</Text>
          <TextInput value={endDate} onChangeText={setEndDate} placeholder="2026-05-02" placeholderTextColor={ph} className={inputClass} />
          <Text className="mb-1 mt-2 text-xs font-playfair text-neutral-500">End time</Text>
          <TextInput value={endTime} onChangeText={setEndTime} placeholder="18:00" placeholderTextColor={ph} className={inputClass} />
          <Text className="mb-1 mt-3 text-xs font-playfair text-neutral-500">Registration opens</Text>
          <TextInput value={regStart} onChangeText={setRegStart} placeholder="2026-04-01" placeholderTextColor={ph} className={inputClass} />
          <Text className="mb-1 mt-2 text-xs font-playfair text-neutral-500">Registration closes</Text>
          <TextInput value={regEnd} onChangeText={setRegEnd} placeholder="2026-04-30" placeholderTextColor={ph} className={inputClass} />

          <Text className="mb-2 mt-4 font-newsreader-bold text-neutral-900 dark:text-white">Location</Text>
          <LabeledIconInput icon="map-pin" label="Venue" value={venue} onChangeText={setVenue} />
          <LabeledIconInput icon="map" label="Address" value={address} onChangeText={setAddress} />
          <LabeledIconInput icon="navigation" label="City" value={city} onChangeText={setCity} />
          <LabeledIconInput icon="map-pin" label="State" value={state} onChangeText={setState} />
          <LabeledIconInput icon="globe" label="Country" value={country} onChangeText={setCountry} />
          <LabeledIconInput icon="hash" label="ZIP" value={zipCode} onChangeText={setZipCode} />

          <Text className="mb-2 mt-4 font-newsreader-bold text-neutral-900 dark:text-white">Registration</Text>
          <LabeledIconInput icon="users" label="Max participants (optional)" value={maxParticipants} onChangeText={setMaxParticipants} keyboardType="number-pad" />
          <LabeledIconInput icon="users" label="Max teams (optional)" value={maxTeams} onChangeText={setMaxTeams} keyboardType="number-pad" />
          <LabeledIconInput icon="dollar-sign" label="Registration fee" value={registrationFee} onChangeText={setRegistrationFee} keyboardType="decimal-pad" />
          <LabeledIconInput icon="dollar-sign" label="Currency" value={currency} onChangeText={setCurrency} />

          <Text className="mb-2 mt-4 font-newsreader-bold text-neutral-900 dark:text-white">Contact</Text>
          <LabeledIconInput icon="mail" label="Email" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          <LabeledIconInput icon="phone" label="Phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

          <Text className="mb-2 mt-4 font-newsreader-bold text-neutral-900 dark:text-white">Banner</Text>
          <Pressable
            onPress={pickBanner}
            disabled={uploading}
            className="mb-2 items-center rounded-2xl border border-dashed border-neutral-300 py-8 dark:border-white/20"
          >
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Feather name="image" size={28} color={isDark ? "#9ca3af" : "#6b7280"} />
                <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65">Tap to upload banner</Text>
              </>
            )}
          </Pressable>
          {bannerImages[0] ? (
            <Text className="font-playfair text-xs text-emerald-600 dark:text-emerald-400">Banner ready</Text>
          ) : null}

          <View className="mt-6 gap-3 pb-10">
            <PrimaryButton title={submitting ? "Saving…" : "Save draft"} onPress={() => submit(false)} disabled={submitting} />
            <Pressable
              onPress={() => submit(true)}
              disabled={submitting}
              className="items-center rounded-2xl border border-primary py-3.5 disabled:opacity-50"
            >
              <Text className="font-newsreader-bold text-primary">Publish event</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
