import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import sportService from "../../services/sportService";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function Sports() {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sportService.getSports({ page: 1, limit: 100, isActive: true });
      const rows = res?.data ?? [];
      setSports(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load sports");
      setSports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const iconColor = isDark ? "rgba(249,250,251,0.85)" : "rgba(17,24,39,0.75)";

  return (
    <OrganizerScreenShell title="Sports">
      <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <Text className="font-playfair text-sm text-amber-900 dark:text-amber-100">
          Full sport configuration (formats, categories) is available on the web organizer dashboard. Below is the
          active catalog you can assign to events.
        </Text>
      </View>
      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : (
        <View className="mt-4 gap-2">
          {sports.map((s) => (
            <View
              key={String(s._id || s.id)}
              className="flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Feather name="award" size={20} color={iconColor} />
              <Text className="flex-1 font-newsreader-bold text-neutral-900 dark:text-white">{s.name}</Text>
            </View>
          ))}
          {sports.length === 0 ? (
            <Text className="py-6 text-center font-playfair text-neutral-600 dark:text-white/60">No sports loaded.</Text>
          ) : null}
        </View>
      )}
    </OrganizerScreenShell>
  );
}
