/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050914",
          900: "#0a0e1a",
          800: "#0f1628",
          700: "#141d35",
          600: "#1a2440",
        },
        surface: "#111827",
        card: "#1a2234",
        "card-hover": "#1f2940",
        amber: { 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" },
        emerald: { 400: "#34d399", 500: "#10b981" },
        rose: { 400: "#fb7185", 500: "#f43f5e" },
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};