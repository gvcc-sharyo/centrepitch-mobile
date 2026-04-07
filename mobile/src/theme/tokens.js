/**
 * Design tokens migrated from `frontend/tailwind.config.js` and `frontend/src/index.css`.
 * Use for programmatic color (icons, charts, navigation theme) and keep in sync with Tailwind `theme.extend.colors`.
 */

/** Primary scale — matches frontend `colors.primary` */
export const primary = {
  50: "#f0fdf4",
  100: "#dcfce7",
  200: "#bbf7d0",
  300: "#86efac",
  400: "#4ade80",
  500: "#0A763A",
  600: "#4ba857",
  700: "#3d8a47",
  800: "#326c3a",
  900: "#2a5a31",
  DEFAULT: "#0A763A",
};

/** Secondary scale — matches frontend `colors.secondary` */
export const secondary = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#4D86EE",
  600: "#3a6fd6",
  700: "#2f5ab3",
  800: "#264791",
  900: "#1e3a76",
  DEFAULT: "#4D86EE",
};

/**
 * Dark mode: primary green reads as #10B981 on dark surfaces (see frontend index.css `.dark .text-primary`).
 */
export const primaryOnDark = "#10B981";

/** App shell backgrounds — matches frontend `body` (@apply bg-gray-50 dark:bg-gray-900) */
export const background = {
  light: "#F9FAFB",
  dark: "#1F2B55",
};

/** Brand dark canvas (landing hero / marketing) — used where frontend uses deep green-black */
export const backgroundBrandDark = "#07130D";

export const appBackground = {
  light: background.light,
  dark: background.dark,
};
