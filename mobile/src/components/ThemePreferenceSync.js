import { useLayoutEffect } from "react";
import { useSelector } from "react-redux";
import { colorScheme } from "nativewind";

import { selectThemePreference } from "../store/slices/uiSlice";

/**
 * Keeps NativeWind / react-native-css-interop in sync with the user's theme choice.
 * Without this, `dark:` classes only follow the OS appearance, so backgrounds stay wrong
 * when the user picks Light or Dark in Settings.
 */
export default function ThemePreferenceSync() {
  const pref = useSelector(selectThemePreference);

  useLayoutEffect(() => {
    if (pref === "system") {
      colorScheme.set("system");
    } else if (pref === "dark") {
      colorScheme.set("dark");
    } else {
      colorScheme.set("light");
    }
  }, [pref]);

  return null;
}
