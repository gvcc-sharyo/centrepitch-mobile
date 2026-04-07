import { useLayoutEffect } from "react";
import { Appearance, AppState } from "react-native";
import { useDispatch, useStore } from "react-redux";

import { setSystemAppearance } from "../store/slices/uiSlice";
import { applyThemeSystemChrome } from "../utils/themeSystemChrome";

function resolveScheme(colorScheme) {
  return colorScheme === "dark" ? "dark" : "light";
}

/**
 * Syncs Redux + system chrome (root bg, Android nav buttons) from the OS theme.
 * Uses useLayoutEffect + Appearance listener so chrome updates immediately, not after a later render.
 */
export default function SystemAppearanceSync() {
  const dispatch = useDispatch();
  const store = useStore();

  useLayoutEffect(() => {
    const sync = (colorScheme) => {
      const scheme = colorScheme ?? Appearance.getColorScheme();
      const next = resolveScheme(scheme);
      const isDark = next === "dark";

      const current = store.getState()?.ui?.systemAppearance;
      if (current !== next) {
        dispatch(setSystemAppearance(next));
      }

      // Always re-apply native chrome on Appearance events so nav bar cannot stay stale
      // when Redux skips a dispatch or JS was out of sync with the system.
      void applyThemeSystemChrome(isDark);
    };

    sync(Appearance.getColorScheme());

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      sync(colorScheme);
    });

    const subApp = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync(Appearance.getColorScheme());
      }
    });

    return () => {
      sub.remove();
      subApp.remove();
    };
  }, [dispatch, store]);

  return null;
}
