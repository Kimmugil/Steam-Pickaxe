import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "rgb(var(--bg-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--bg-secondary-rgb) / <alpha-value>)",
          card:      "rgb(var(--bg-card-rgb) / <alpha-value>)",
          hover:     "rgb(var(--bg-hover-rgb) / <alpha-value>)",
        },
        accent: {
          blue:   "rgb(var(--accent-blue-rgb) / <alpha-value>)",
          green:  "rgb(var(--accent-green-rgb) / <alpha-value>)",
          red:    "rgb(var(--accent-red-rgb) / <alpha-value>)",
          orange: "rgb(var(--accent-orange-rgb) / <alpha-value>)",
          yellow: "rgb(var(--accent-yellow-rgb) / <alpha-value>)",
          purple: "rgb(var(--accent-purple-rgb) / <alpha-value>)",
        },
        text: {
          primary:   "rgb(var(--text-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
          muted:     "rgb(var(--text-muted-rgb) / <alpha-value>)",
        },
        border: {
          default: "rgb(var(--border-default-rgb) / <alpha-value>)",
          hover:   "rgb(var(--border-hover-rgb) / <alpha-value>)",
        },
        sale:        "rgb(var(--sale-rgb) / <alpha-value>)",
        freeweekend: "rgb(var(--freeweekend-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Pretendard", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
