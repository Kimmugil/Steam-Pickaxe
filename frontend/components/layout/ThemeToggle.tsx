"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-0.5 bg-bg-primary border border-border-default rounded-full p-0.5">
      <button
        onClick={() => setTheme("light")}
        title="라이트 모드"
        aria-label="라이트 모드로 전환"
        className={`p-1.5 rounded-full transition-all ${
          theme === "light"
            ? "bg-accent-yellow/20 text-accent-yellow"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        title="다크 모드"
        aria-label="다크 모드로 전환"
        className={`p-1.5 rounded-full transition-all ${
          theme === "dark"
            ? "bg-accent-blue/15 text-accent-blue"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
