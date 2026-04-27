import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#111217",
        surface: "#181b1f",
        card: "#22252b",
        elevated: "#2c2f35",
        hover: "#383b42",
        border: {
          DEFAULT: "#2c2f35",
          med: "#44474e",
          strong: "#5f6268",
        },
        text: {
          DEFAULT: "#d6d7d9",
          secondary: "#8c8f94",
          disabled: "#6e7177",
        },
        primary: {
          DEFAULT: "#3d71d9",
          text: "#6e9fff",
        },
        success: {
          DEFAULT: "#1a7f4b",
          text: "#6ccf8e",
        },
        warning: {
          DEFAULT: "#ff9900",
          text: "#fbad37",
        },
        error: {
          DEFAULT: "#d10e5c",
          text: "#ff5286",
        },
        "brand-start": "#F55F3E",
        "brand-end": "#FF8833",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
