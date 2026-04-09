import React, { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

function teamSportName(team) {
  return String(team?.sport?.name || team?.sportName || "").trim();
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "T";
}

function chipClass(variant) {
  // Colors match the web organizer Teams card chips.
  if (variant === "sport")
    return "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300";
  if (variant === "age")
    return "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-300";
  if (variant === "format")
    return "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-300";
  if (variant === "gender")
    return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300";
  if (variant === "type")
    return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300";
  return "bg-neutral-100 border-neutral-200 text-neutral-700 dark:bg-white/10 dark:border-white/15 dark:text-white/75";
}

/**
 * Reusable team card (web-inspired) for organizer/coach/academy lists.
 *
 * Props:
 * - team: team object
 * - isDark: boolean (theme)
 * - containerClassName: optional string for outer spacing (e.g. "mx-1.5 flex-1")
 * - onPress: card press (view detail)
 * - onView / onManagePlayers / onEdit / onDelete: optional actions
 * - canEdit: boolean (controls Edit/Delete visibility)
 */
function TeamCardImpl({
  team,
  isDark,
  containerClassName = "",
  onPress,
  onView,
  onManagePlayers,
  onEdit,
  onDelete,
  canEdit = false,
}) {
  const sportName = teamSportName(team);
  const age = String(team?.ageCategory || "").replaceAll("_", " ");
  const format = String(team?.gameFormat || "").replaceAll("_", " ");
  const gender = String(team?.genderCategory || "").replaceAll("_", " ");
  const teamType = team?.teamType === "permanent" ? "Permanent" : team?.teamType ? "Event Specific" : "";
  const memberCount = Array.isArray(team?.members) ? team.members.length : team?.memberCount ?? 0;
  const location = [team?.location?.city, team?.location?.state].filter(Boolean).join(", ");
  const email = String(team?.contactEmail || "").trim();
  const phone = String(team?.contactPhone || "").trim();
  const subtitle = String(team?.description || "").trim();
  const primary = team?.primaryColor || "#6366f1";

  const actions = useMemo(() => {
    const list = [];
    if (onView) list.push({ key: "view", icon: "eye", onPress: onView });
    if (onManagePlayers) list.push({ key: "players", icon: "users", onPress: onManagePlayers });
    if (canEdit && onEdit) list.push({ key: "edit", icon: "edit-2", onPress: onEdit });
    if (canEdit && onDelete) list.push({ key: "delete", icon: "trash-2", onPress: onDelete });
    return list;
  }, [canEdit, onDelete, onEdit, onManagePlayers, onView]);

  return (
    <Pressable
      onPress={onPress}
      className={`mb-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 ${containerClassName}`}
    >
      <View className="flex-row gap-4">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl border-2"
          style={{
            borderColor: primary,
            backgroundColor: `${primary}15`,
          }}
        >
          <Feather name="shield" size={22} color={primary} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 font-newsreader-bold text-base text-neutral-900 dark:text-white" numberOfLines={2}>
              {team?.name || "Team"}
            </Text>

            {actions.length > 0 ? (
              <View className="flex-row items-center gap-2">
                {actions.map((a) => (
                  <Pressable
                    key={a.key}
                    onPress={(e) => {
                      e.stopPropagation();
                      a.onPress?.();
                    }}
                    hitSlop={10}
                    className="h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/10"
                  >
                    <Feather
                      name={a.icon}
                      size={16}
                      color={isDark ? "rgba(255,255,255,0.7)" : "rgba(17,24,39,0.65)"}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            {sportName ? (
              <View className={`rounded-full border px-2 py-0.5 ${chipClass("sport")}`}>
                <Text className="font-playfair text-[11px]">{sportName}</Text>
              </View>
            ) : null}
            {age ? (
              <View className={`rounded-full border px-2 py-0.5 ${chipClass("age")}`}>
                <Text className="font-playfair text-[11px] capitalize">{age}</Text>
              </View>
            ) : null}
            {format ? (
              <View className={`rounded-full border px-2 py-0.5 ${chipClass("format")}`}>
                <Text className="font-playfair text-[11px] capitalize">{format}</Text>
              </View>
            ) : null}
            {gender ? (
              <View className={`rounded-full border px-2 py-0.5 ${chipClass("gender")}`}>
                <Text className="font-playfair text-[11px] capitalize">{gender}</Text>
              </View>
            ) : null}
            {teamType ? (
              <View className={`rounded-full border px-2 py-0.5 ${chipClass("type")}`}>
                <Text className="font-playfair text-[11px]">{teamType}</Text>
              </View>
            ) : null}
          </View>

          {subtitle ? (
            <Text className="mt-2 font-playfair text-sm text-neutral-600 dark:text-white/65" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}

          <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <View className="flex-row items-center gap-1">
              <Feather name="users" size={14} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"} />
              <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">
                {memberCount} {memberCount === 1 ? "members" : "members"}
              </Text>
            </View>
            {location ? (
              <View className="flex-row items-center gap-1">
                <Feather name="map-pin" size={14} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"} />
                <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55" numberOfLines={1}>
                  {location}
                </Text>
              </View>
            ) : null}
            {email ? (
              <View className="flex-row items-center gap-1">
                <Feather name="mail" size={14} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"} />
                <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            ) : null}
            {phone ? (
              <View className="flex-row items-center gap-1">
                <Feather name="phone" size={14} color={isDark ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.45)"} />
                <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55" numberOfLines={1}>
                  {phone}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-4 h-px bg-neutral-200 dark:bg-white/10" />
          <View className="mt-3 flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-neutral-200 dark:bg-white/10">
              <Text className="font-newsreader-bold text-[11px] text-neutral-700 dark:text-white/75">
                {initials(team?.name)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const TeamCard = memo(TeamCardImpl);

