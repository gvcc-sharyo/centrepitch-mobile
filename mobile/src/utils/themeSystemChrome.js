import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";

const THEME_ROOT_BG_LIGHT = "#FFFFFF";
const THEME_ROOT_BG_DARK = "#1F2B55";

/**
 * Aligns system UI with app light/dark theme.
 *
 * With edge-to-edge (required on Android 16+), Android does not allow setting a solid
 * navigation bar color from JS — only button appearance. Root background + insets still
 * come from SystemUI and your layouts. See `androidNavigationBar.enforceContrast` in app.json.
 */
export async function applyThemeSystemChrome(isDark) {
  const bg = isDark ? THEME_ROOT_BG_DARK : THEME_ROOT_BG_LIGHT;
  try {
    await SystemUI.setBackgroundColorAsync(bg);
    if (Platform.OS === "android") {
      await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
    }
  } catch {
    /* web / unsupported */
  }
}
