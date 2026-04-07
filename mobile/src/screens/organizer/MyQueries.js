import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import organizerService from "../../services/organizerService";
import { selectTheme } from "../../store/slices/uiSlice";
import { formatDate, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function MyQueries() {
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.8)" : "rgba(17,24,39,0.75)";

  const [loading, setLoading] = useState(true);
  const [queries, setQueries] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizerService.getMyQueries({ page: 1, limit: 50 });
      const rows = res?.data ?? res?.queries ?? [];
      setQueries(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not load queries");
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <OrganizerScreenShell title="My queries">
      {loading ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : queries.length === 0 ? (
        <View className="items-center rounded-2xl border border-neutral-200 bg-white p-8 dark:border-white/10 dark:bg-white/5">
          <Feather name="message-square" size={40} color={iconColor} />
          <Text className="mt-3 text-center font-playfair text-neutral-600 dark:text-white/65">No queries yet.</Text>
        </View>
      ) : (
        <View className="gap-3">
          {queries.map((q) => (
            <View
              key={String(q._id || q.id)}
              className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{q.subject || "Query"}</Text>
              {q.status ? (
                <Text className="mt-1 font-playfair text-xs text-primary capitalize">{q.status}</Text>
              ) : null}
              {q.createdAt ? (
                <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/50">
                  {formatDate(q.createdAt, "MMM dd, yyyy")}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </OrganizerScreenShell>
  );
}
