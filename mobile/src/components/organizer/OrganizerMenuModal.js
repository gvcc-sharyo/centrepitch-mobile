import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import { SCREENS } from "../../constants/navigation";
import { navigateToOrganizerTab } from "../../navigation/navigationRef";
import { selectMobileMenuOpen, selectTheme, setMobileMenuOpen } from "../../store/slices/uiSlice";

const MENU_ITEMS = [
  { label: "Sports configuration", tab: SCREENS.OrganizerTabHome, screen: SCREENS.OrganizerSports, icon: "award" },
  { label: "Contact admin", tab: SCREENS.OrganizerTabHome, screen: SCREENS.OrganizerContactAdmin, icon: "mail" },
  { label: "My queries", tab: SCREENS.OrganizerTabHome, screen: SCREENS.OrganizerMyQueriesScreen, icon: "message-square" },
  { label: "Settings", tab: SCREENS.OrganizerTabProfile, screen: SCREENS.Settings, icon: "settings" },
];

export default function OrganizerMenuModal() {
  const open = useSelector(selectMobileMenuOpen);
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const theme = useSelector(selectTheme);
  const isDark = theme === "dark";
  const iconColor = useMemo(
    () => (isDark ? "rgba(249,250,251,0.88)" : "rgba(17,24,39,0.82)"),
    [isDark]
  );

  const close = () => dispatch(setMobileMenuOpen(false));

  const onNavigate = (tab, screen) => {
    close();
    navigateToOrganizerTab(tab, screen);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View className="flex-1 flex-row">
        <Pressable className="flex-1 bg-black/45" onPress={close} accessibilityLabel="Close menu" />
        <View
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          className="w-[86%] max-w-[340px] border-l border-neutral-200 bg-white dark:border-white/10 dark:bg-[#1F2B55]"
        >
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/10">
            <Text className="font-newsreader-bold text-xl text-neutral-900 dark:text-white">Menu</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              className="rounded-full bg-neutral-100 p-2 dark:bg-white/10"
            >
              <Feather name="x" size={22} color={iconColor} />
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-2 pt-2" keyboardShouldPersistTaps="handled">
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={`${item.tab}-${item.screen}`}
                onPress={() => onNavigate(item.tab, item.screen)}
                className="mb-1 flex-row items-center gap-3 rounded-xl px-3 py-3.5 active:bg-neutral-100 dark:active:bg-white/10"
              >
                <Feather name={item.icon} size={20} color={iconColor} />
                <Text className="flex-1 font-playfair text-base text-neutral-800 dark:text-white/90">{item.label}</Text>
                <Feather name="chevron-right" size={18} color={iconColor} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
