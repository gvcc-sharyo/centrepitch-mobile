import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import coachTeamService from "../../services/coachTeamService";
import teamService from "../../services/teamService";
import { selectUser } from "../../store/slices/authSlice";
import { toast } from "../../utils/toast";

const TABS = [
  { id: "all", label: "All" },
  { id: "event", label: "Event" },
  { id: "academy", label: "Academy" },
  { id: "coach", label: "Coach" },
];

export default function Teams() {
  const insets = useSafeAreaInsets();
  const user = useSelector(selectUser);

  const [activeTab, setActiveTab] = useState("all");
  const [teamsByUser, setTeamsByUser] = useState([]);
  const [coachTeams, setCoachTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isCoachTeam, setIsCoachTeam] = useState(false);
  const [teamDetails, setTeamDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!user?._id) {
      setTeamsByUser([]);
      setCoachTeams([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [userRes, coachRes] = await Promise.all([
        teamService.getTeamsByUser(user._id),
        teamService.getCoachTeamsByUser(user._id),
      ]);
      setTeamsByUser(Array.isArray(userRes) ? userRes : userRes?.data || []);
      setCoachTeams(Array.isArray(coachRes) ? coachRes : coachRes?.data || []);
    } catch {
      toast.error("Failed to load teams");
      setTeamsByUser([]);
      setCoachTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const eventTeams = useMemo(() => teamsByUser.filter((t) => !t.academy), [teamsByUser]);
  const academyTeams = useMemo(() => teamsByUser.filter((t) => t.academy), [teamsByUser]);

  const displayList = useMemo(() => {
    if (activeTab === "all") {
      return [...teamsByUser, ...coachTeams.map((t) => ({ ...t, _teamType: "coach" }))];
    }
    if (activeTab === "event") return eventTeams;
    if (activeTab === "academy") return academyTeams;
    return coachTeams.map((t) => ({ ...t, _teamType: "coach" }));
  }, [activeTab, teamsByUser, coachTeams, eventTeams, academyTeams]);

  const isCaptain = (team) => {
    const captainId = team.captain?._id || team.captain;
    return captainId && captainId.toString() === user?._id?.toString();
  };

  const openTeam = async (team) => {
    const isCoach = team._teamType === "coach" || coachTeams.some((t) => t._id === team._id);
    setSelectedTeam(team);
    setIsCoachTeam(isCoach);
    setShowModal(true);
    setLoadingDetails(true);
    setTeamDetails(null);
    try {
      if (isCoach) {
        const res = await coachTeamService.getTeamById(team._id);
        const body = res?.data ?? res;
        setTeamDetails(body?.data ?? body);
      } else {
        const res = await teamService.getTeamById(team._id);
        setTeamDetails(res?.data ?? res);
      }
    } catch {
      toast.error("Failed to load team details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTeam(null);
    setTeamDetails(null);
  };

  const allTeamsForStats = [...teamsByUser, ...coachTeams];
  const totalTeams = allTeamsForStats.length;
  const totalSports = new Set(
    allTeamsForStats.map((t) => (t.sport?._id || t.sport)?.toString()).filter(Boolean)
  ).size;
  const totalWins = teamsByUser.reduce((sum, t) => sum + (t.stats?.wins || 0), 0);
  const totalLosses = teamsByUser.reduce((sum, t) => sum + (t.stats?.losses || 0), 0);

  const StatCard = ({ icon, label, value, valueClass }) => (
    <View className="min-w-[46%] flex-1 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <View className="flex-row items-center gap-2">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Feather name={icon} size={18} color="#1F2B55" />
        </View>
        <View>
          <Text className={`text-2xl font-newsreader-bold ${valueClass || "text-neutral-900 dark:text-white"}`}>
            {value}
          </Text>
          <Text className="text-xs font-playfair text-neutral-500 dark:text-white/55">{label}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Teams" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-3">
          <Text className="text-2xl font-newsreader-bold text-neutral-900 dark:text-white">My Teams</Text>
          <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
            Teams you belong to — tap a card for details.
          </Text>
        </View>

        <View className="mt-5 flex-row flex-wrap gap-3">
          <StatCard icon="users" label="Total teams" value={totalTeams} />
          <StatCard icon="award" label="Sports" value={totalSports} />
          <StatCard icon="trending-up" label="Wins" value={totalWins} valueClass="text-emerald-600 dark:text-emerald-400" />
          <StatCard icon="trending-down" label="Losses" value={totalLosses} valueClass="text-red-600 dark:text-red-400" />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-6"
          contentContainerStyle={{ gap: 8 }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-2.5 ${active ? "bg-primary" : "bg-neutral-100 dark:bg-white/10"}`}
              >
                <Text
                  className={`text-sm font-newsreader-bold ${active ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#1F2B55" />
          </View>
        ) : displayList.length === 0 ? (
          <View className="mt-8 items-center rounded-2xl border border-neutral-200 bg-white py-14 dark:border-white/10 dark:bg-white/5">
            <Feather name="users" size={48} color="rgba(255,255,255,0.25)" />
            <Text className="mt-4 font-newsreader-bold text-neutral-900 dark:text-white">No teams yet</Text>
            <Text className="mt-2 max-w-sm text-center text-sm font-playfair text-neutral-600 dark:text-white/65">
              When you join event, academy, or coach teams, they will show up here.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {displayList.map((team) => {
              const isCoach = team._teamType === "coach" || coachTeams.some((t) => t._id === team._id);
              const sportName = team.sport?.name || team.sportName;
              const location = team.location?.city || team.city;
              const memberCount = team.members?.length ?? team.players?.length ?? 0;
              const typeBadge = isCoach ? "Coach" : team.academy ? "Academy" : "Event";
              return (
                <Pressable
                  key={team._id}
                  onPress={() => openTeam(team)}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <View className="flex-row items-start gap-3">
                    <View className="h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      <Feather name="users" size={26} color="#1F2B55" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-base font-newsreader-bold text-neutral-900 dark:text-white">{team.name}</Text>
                        {!isCoach && isCaptain(team) ? (
                          <View className="rounded-full bg-emerald-500/15 px-2 py-0.5">
                            <Text className="text-[10px] font-newsreader-bold text-emerald-700 dark:text-emerald-300">Captain</Text>
                          </View>
                        ) : null}
                        <View className="rounded-full bg-neutral-200 px-2 py-0.5 dark:bg-white/15">
                          <Text className="text-[10px] font-newsreader-bold text-neutral-700 dark:text-white/90">{typeBadge}</Text>
                        </View>
                      </View>
                      {sportName ? (
                        <Text className="mt-1 text-xs font-playfair font-semibold text-primary">{sportName}</Text>
                      ) : null}
                      <View className="mt-2 gap-1">
                        <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">
                          {memberCount} member{memberCount === 1 ? "" : "s"}
                        </Text>
                        {location ? (
                          <View className="flex-row items-center gap-1">
                            <Feather name="map-pin" size={12} color="rgba(31,43,85,0.6)" />
                            <Text className="text-sm font-playfair text-neutral-600 dark:text-white/65">
                              {location}
                              {team.location?.state ? `, ${team.location.state}` : team.state ? `, ${team.state}` : ""}
                            </Text>
                          </View>
                        ) : null}
                        {isCoach && team.coach ? (
                          <Text className="text-xs font-playfair text-neutral-500 dark:text-white/50">
                            Coach: {team.coach.firstName} {team.coach.lastName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <View className="mt-4 h-10 items-center justify-center rounded-xl bg-primary">
                    <Text className="font-newsreader-bold text-white">View details</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={closeModal} />
          <View
            className="max-h-[85%] rounded-t-3xl bg-white px-5 pt-4 dark:bg-[#1F2B55]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300 dark:bg-white/25" />
            <Text className="text-lg font-newsreader-bold text-neutral-900 dark:text-white">
              {teamDetails?.name || selectedTeam?.name || "Team"}
            </Text>
            {loadingDetails ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#1F2B55" />
              </View>
            ) : teamDetails ? (
              <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap items-center gap-2">
                  {isCoachTeam ? (
                    <View className="rounded-full bg-amber-500/20 px-2 py-0.5">
                      <Text className="text-xs font-newsreader-bold text-amber-800 dark:text-amber-200">Coach team</Text>
                    </View>
                  ) : null}
                  {!isCoachTeam && isCaptain(teamDetails) ? (
                    <View className="rounded-full bg-emerald-500/15 px-2 py-0.5">
                      <Text className="text-xs font-newsreader-bold text-emerald-700 dark:text-emerald-300">Captain</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-2 text-sm font-playfair font-semibold text-primary">
                  {teamDetails.sport?.name || teamDetails.sportName || "—"}
                </Text>
                {isCoachTeam && teamDetails.coach ? (
                  <Text className="mt-1 text-sm font-playfair text-neutral-600 dark:text-white/70">
                    Coach: {teamDetails.coach.firstName} {teamDetails.coach.lastName}
                  </Text>
                ) : null}
                {teamDetails.description ? (
                  <Text className="mt-3 text-sm font-playfair leading-5 text-neutral-700 dark:text-white/80">
                    {teamDetails.description}
                  </Text>
                ) : null}

                {(teamDetails.location?.city || teamDetails.location?.country) && (
                  <View className="mt-4">
                    <Text className="text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">Location</Text>
                    <View className="mt-1 flex-row items-start gap-2">
                      <Feather name="map-pin" size={16} color="#1F2B55" />
                      <Text className="flex-1 text-sm font-playfair text-neutral-700 dark:text-white/75">
                        {[teamDetails.location?.city, teamDetails.location?.state, teamDetails.location?.country]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  </View>
                )}

                {(teamDetails.contactEmail || teamDetails.contactPhone) && (
                  <View className="mt-4">
                    <Text className="text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">Contact</Text>
                    {teamDetails.contactEmail ? (
                      <Text className="mt-1 text-sm text-primary">{teamDetails.contactEmail}</Text>
                    ) : null}
                    {teamDetails.contactPhone ? (
                      <Text className="mt-1 text-sm font-playfair text-neutral-700 dark:text-white/75">{teamDetails.contactPhone}</Text>
                    ) : null}
                  </View>
                )}

                {Array.isArray(teamDetails.members || teamDetails.players) && (
                  <View className="mt-4 pb-6">
                    <Text className="text-xs font-newsreader-bold uppercase text-neutral-500 dark:text-white/45">Members</Text>
                    {(teamDetails.members || teamDetails.players).slice(0, 20).map((m, i) => (
                      <Text key={m._id || i} className="mt-2 text-sm font-playfair text-neutral-800 dark:text-white/85">
                        • {m.player?.name || m.name || m.email || "Member"}
                        {m.role ? ` (${m.role})` : ""}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : (
              <Text className="mt-4 font-playfair text-neutral-600 dark:text-white/65">Could not load details.</Text>
            )}
            <Pressable onPress={closeModal} className="mt-4 h-11 items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/15">
              <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
