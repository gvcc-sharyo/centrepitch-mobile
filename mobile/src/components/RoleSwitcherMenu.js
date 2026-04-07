import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import authService from "../services/authService";
import { getMe, selectIsAuthenticated, selectUser } from "../store/slices/authSlice";
import { selectTheme } from "../store/slices/uiSlice";
import { getErrorMessage } from "../utils/helpers";
import { toast } from "../utils/toast";
import UserStarIcon from "./icons/UserStarIcon";
import SubscriptionFlowModal from "./SubscriptionFlowModal";

const ALLOWED_ROLES = ["player", "coach", "academyadmin", "organizer"];

const ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  academyadmin: "Academy Admin",
  organizer: "Organizer",
};

function getRoleRefByName(user, roleName) {
  const normalized = String(roleName || "").toLowerCase();
  const fromUnlocked = (Array.isArray(user?.unlockedRoles) ? user.unlockedRoles : []).find(
    (entry) => String(entry?.role || "").toLowerCase() === normalized
  );
  const unlockedRoleRef = String(fromUnlocked?.roleRef?._id || fromUnlocked?.roleRef || "").trim();
  if (unlockedRoleRef) return unlockedRoleRef;
  if (String(user?.role || "").toLowerCase() === normalized) {
    return String(user?.roleRef?._id || user?.roleRef || "").trim();
  }
  return "";
}

/**
 * Header control: user-star opens menu for switching unlocked roles + unlock / upgrade subscription.
 */
export default function RoleSwitcherMenu() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const isDark = theme === "dark";
  const iconColor = isDark ? "rgba(249,250,251,0.92)" : "rgba(17,24,39,0.85)";

  const [menuOpen, setMenuOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const userRole = String(user?.role || "player").toLowerCase();
  const isPlayer = userRole === "player";

  const unlockedEntries = useMemo(() => {
    const byName = new Map();
    const raw = Array.isArray(user?.unlockedRoles) ? user.unlockedRoles : [];
    raw.forEach((entry) => {
      const roleName = String(entry?.role || "").toLowerCase();
      if (!ALLOWED_ROLES.includes(roleName)) return;
      const roleRef =
        String(entry?.roleRef?._id || entry?.roleRef || "").trim() || getRoleRefByName(user, roleName);
      if (!byName.has(roleName)) byName.set(roleName, { roleName, roleRef });
    });
    const cur = String(user?.role || "").toLowerCase();
    if (ALLOWED_ROLES.includes(cur) && !byName.has(cur)) {
      byName.set(cur, { roleName: cur, roleRef: getRoleRefByName(user, cur) });
    }
    return Array.from(byName.values());
  }, [user]);

  const switchToRole = useCallback(
    async (nextRole, roleRef) => {
      const normalized = String(nextRole || "").toLowerCase();
      if (!normalized) return;
      const resolved = String(roleRef || getRoleRefByName(user, normalized)).trim();
      if (!resolved) {
        toast.error("Role reference not found");
        return;
      }
      try {
        await authService.switchRole({ roleRef: resolved });
        await dispatch(getMe()).unwrap();
        toast.success(`Switched to ${ROLE_LABELS[normalized] || normalized}`);
        setMenuOpen(false);
      } catch (e) {
        toast.error(getErrorMessage(e) || "Failed to switch role");
      }
    },
    [dispatch, user]
  );

  if (!isAuthenticated || !user) return null;

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Roles and subscriptions"
        className="h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
      >
        <UserStarIcon size={20} color={iconColor} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          <View
            className="rounded-2xl border border-neutral-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#1a2545]"
            style={{
              position: "absolute",
              top: Math.max(insets.top, 8) + 44,
              right: 16,
              width: 280,
              maxHeight: 420,
              zIndex: 2,
            }}
          >
          <View className="border-b border-neutral-100 px-4 py-3 dark:border-white/10">
            <Text className="text-sm font-newsreader-bold text-neutral-900 dark:text-white">Your roles</Text>
            <Text className="mt-0.5 text-xs font-playfair text-neutral-500 dark:text-white/55">
              Tap to switch. Current role is highlighted.
            </Text>
          </View>
          <ScrollView className="max-h-[260px]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {unlockedEntries.length === 0 ? (
              <Text className="px-4 py-3 text-sm font-playfair text-neutral-500 dark:text-white/60">
                No extra roles unlocked yet.
              </Text>
            ) : (
              unlockedEntries.map(({ roleName, roleRef }) => {
                const active = userRole === roleName;
                const label = ROLE_LABELS[roleName] || roleName;
                return (
                  <Pressable
                    key={roleName}
                    onPress={() => !active && roleRef && switchToRole(roleName, roleRef)}
                    disabled={active || !roleRef}
                    className={[
                      "border-b border-neutral-100 px-4 py-3 dark:border-white/10",
                      active ? "bg-primary/10" : "active:bg-neutral-50 dark:active:bg-white/5",
                    ].join(" ")}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={[
                          "text-sm font-newsreader-bold",
                          active ? "text-primary dark:text-indigo-300" : "text-neutral-900 dark:text-white",
                        ].join(" ")}
                      >
                        {label}
                      </Text>
                      {active ? (
                        <Text className="text-xs font-playfair text-primary dark:text-indigo-300">Current</Text>
                      ) : (
                        <Feather name="chevron-right" size={16} color={iconColor} />
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View className="border-t border-neutral-100 p-2 dark:border-white/10">
            {isPlayer ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setUnlockModalOpen(true);
                }}
                className="flex-row items-center gap-2 rounded-xl px-3 py-2.5 active:bg-neutral-50 dark:active:bg-white/10"
              >
                <Feather name="unlock" size={18} color="#6366F1" />
                <Text className="flex-1 text-sm font-newsreader-bold text-indigo-600 dark:text-indigo-300">
                  Unlock roles
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setUpgradeModalOpen(true);
                }}
                className="flex-row items-center gap-2 rounded-xl px-3 py-2.5 active:bg-neutral-50 dark:active:bg-white/10"
              >
                <Feather name="trending-up" size={18} color="#059669" />
                <Text className="flex-1 text-sm font-newsreader-bold text-emerald-700 dark:text-emerald-300">
                  Upgrade role
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        </View>
      </Modal>

      <SubscriptionFlowModal visible={unlockModalOpen} onClose={() => setUnlockModalOpen(false)} variant="unlock" />
      <SubscriptionFlowModal
        visible={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        variant="upgrade"
      />
    </>
  );
}
