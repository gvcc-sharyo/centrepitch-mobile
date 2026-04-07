/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
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
        },
        secondary: {
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
        },
        /** CTAs / verify / attention (amber–orange) */
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
          DEFAULT: "#EA580C",
        },
      },
      fontFamily: {
        /** Default body copy — Playfair. Use `font-newsreader-bold` / `font-newsreader-semibold` for display headings. */
        sans: ["PlayfairDisplay_400Regular", "Georgia", "serif"],
        newsreader: ["Newsreader_400Regular"],
        "newsreader-semibold": ["Newsreader_600SemiBold"],
        "newsreader-bold": ["Newsreader_700Bold"],
        playfair: ["PlayfairDisplay_400Regular", "Georgia", "serif"],
        "playfair-bold": ["PlayfairDisplay_700Bold", "Georgia", "serif"],
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
