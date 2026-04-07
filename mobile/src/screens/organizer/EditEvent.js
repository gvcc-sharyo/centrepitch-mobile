import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import eventService from "../../services/eventService";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatCurrency, formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function EditEvent() {
  const route = useRoute();
  const eventId = route.params?.eventId;
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [registrationFee, setRegistrationFee] = useState("0");
  const [isPublished, setIsPublished] = useState(false);
  const [publishPricing, setPublishPricing] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await eventService.getEventById(String(eventId));
      const ev = res?.data ?? res;
      setEvent(ev);
      setName(ev?.name || "");
      setDescription(ev?.description || "");
      setVenue(ev?.location?.venue || "");
      setCity(ev?.location?.city || "");
      setState(ev?.location?.state || "");
      setCountry(ev?.location?.country || "");
      setRegistrationFee(String(ev?.registrationFee ?? 0));
      setIsPublished(Boolean(ev?.isPublished));
      const sportRef = ev?.sport;
      const sportId = sportRef && typeof sportRef === "object" ? sportRef._id : sportRef;
      if (sportId) {
        try {
          const pr = await eventService.getPublishPricing({ sportId: String(sportId) });
          setPublishPricing(pr?.data ?? pr);
        } catch {
          setPublishPricing(null);
        }
      } else {
        setPublishPricing(null);
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load event");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!eventId || !name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await eventService.updateEvent(String(eventId), {
        name: name.trim(),
        description: description.trim(),
        location: {
          ...(event?.location || {}),
          venue: venue.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
        },
        registrationFee: parseFloat(registrationFee) || 0,
        isPublished,
      });
      toast.success("Event updated");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  if (!eventId) {
    return (
      <OrganizerScreenShell title="Edit event">
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing event.</Text>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title="Edit event" scrollable={false}>
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : !event ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Event not found.</Text>
      ) : (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-3 font-playfair text-sm text-neutral-500 dark:text-white/50">
            {event.startDate ? `Starts ${formatDate(event.startDate, "MMM dd, yyyy")}` : ""}
          </Text>
          <LabeledIconInput icon="edit-2" label="Event name" value={name} onChangeText={setName} />
          <Text className="mb-1 mt-3 font-playfair text-sm text-neutral-600 dark:text-white/60">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            placeholderTextColor={ph}
            multiline
            className={`min-h-[120px] ${inputClass}`}
            textAlignVertical="top"
          />
          <LabeledIconInput icon="map-pin" label="Venue" value={venue} onChangeText={setVenue} />
          <LabeledIconInput icon="navigation" label="City" value={city} onChangeText={setCity} />
          <LabeledIconInput icon="map-pin" label="State" value={state} onChangeText={setState} />
          <LabeledIconInput icon="globe" label="Country" value={country} onChangeText={setCountry} />
          <LabeledIconInput icon="dollar-sign" label="Registration fee" value={registrationFee} onChangeText={setRegistrationFee} keyboardType="decimal-pad" />

          <Pressable
            onPress={() => setIsPublished((p) => !p)}
            className="mt-4 flex-row items-center gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-white/10"
          >
            <Feather name={isPublished ? "check-square" : "square"} size={22} color={isDark ? "#fff" : "#111"} />
            <Text className="flex-1 font-playfair text-neutral-900 dark:text-white">Published (visible to players)</Text>
          </Pressable>
          {publishPricing && typeof publishPricing.totalAmount === "number" ? (
            <View className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <Text className="font-playfair text-sm text-neutral-700 dark:text-white/80">
                Publish pricing (platform): {formatCurrency(publishPricing.totalAmount, publishPricing.currency || "INR")}{" "}
                incl. GST ({publishPricing.gstPercent ?? 0}% on {formatCurrency(publishPricing.baseAmount ?? 0, publishPricing.currency || "INR")} base)
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={save}
            disabled={saving}
            className="mt-6 items-center rounded-2xl bg-primary py-3.5 disabled:opacity-50"
          >
            <Text className="font-newsreader-bold text-white">{saving ? "Saving…" : "Save changes"}</Text>
          </Pressable>
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
