import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Steam 느낌의 다크 테마
        bg: {
          primary: "#0f1117",
          secondary: "#1a1d27",
          card: "#1e2130",
          hover: "#252840",
        },
        accent: {
          blue: "#4f87ff",
          green: "#5db865",
          red: "#e05c5c",
          orange: "#e08c45",
          yellow: "#d4b84a",
          purple: "#8b6fe8",
        },
        text: {
          primary: "#e8eaf0",
          secondary: "#8b91a8",
          muted: "#555c75",
        },
        border: {
          default: "#2a2f45",
          hover: "#3d4460",
        },
        sale: "#e08c45",
        freeweekend: "#5db865",
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
