import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import teamService from "../../services/teamService";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

export default function OrganizerTeamDetail() {
  const route = useRoute();
  const teamId = route.params?.teamId;

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await teamService.getTeamById(String(teamId));
      const data = res?.data ?? res;
      setTeam(data);
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to load team");
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const card =
    "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5";

  return (
    <OrganizerScreenShell title="Team detail" scrollable={false}>
      {!teamId ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Missing team.</Text>
      ) : loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      ) : !team ? (
        <Text className="font-playfair text-neutral-600 dark:text-white/65">Team not found.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className={card}>
            <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">{team.name}</Text>
            {team.description ? (
              <Text className="mt-2 font-playfair text-sm leading-5 text-neutral-600 dark:text-white/70">
                {team.description}
              </Text>
            ) : null}
          </View>
          <View className={`${card} mt-3`}>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Sport</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
              {team.sport?.name || "—"}
            </Text>
          </View>
          <View className={`${card} mt-3`}>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Type</Text>
            <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/70">
              {team.teamType || "—"}
            </Text>
          </View>
          {Array.isArray(team.members) && team.members.length > 0 ? (
            <View className={`${card} mt-3`}>
              <Text className="mb-2 font-newsreader-bold text-neutral-900 dark:text-white">Members</Text>
              {team.members.slice(0, 20).map((m, i) => (
                <Text key={String(m._id || i)} className="font-playfair text-sm text-neutral-700 dark:text-white/80">
                  {m.user?.firstName || m.name || "Member"} {m.user?.lastName || ""}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </OrganizerScreenShell>
  );
}
