"use client";
import { useState } from "react";
import { useUiText } from "@/contexts/UiTextContext";

interface LifecycleData {
  early:  string;
  growth: string;
  mature: string;
}

interface Props {
  lifecycleComment?: string; // JSON string from game.lifecycle_comment
}

const PHASE_CONFIG = [
  {
    key:     "early"  as const,
    icon:    "🌱",
    labelKey: "LIFECYCLE_EARLY_LABEL",
    colorBg:   "bg-accent-green/5",
    colorBorder: "border-accent-green/20",
    colorTitle: "text-accent-green",
  },
  {
    key:     "growth" as const,
    icon:    "🔥",
    labelKey: "LIFECYCLE_GROWTH_LABEL",
    colorBg:   "bg-accent-blue/5",
    colorBorder: "border-accent-blue/20",
    colorTitle: "text-accent-blue",
  },
  {
    key:     "mature" as const,
    icon:    "🏛️",
    labelKey: "LIFECYCLE_MATURE_LABEL",
    colorBg:   "bg-accent-yellow/5",
    colorBorder: "border-accent-yellow/20",
    colorTitle: "text-accent-yellow",
  },
];

export default function LifecycleSummary({ lifecycleComment }: Props) {
  const { t } = useUiText();
  const [expanded, setExpanded] = useState(false);

  if (!lifecycleComment) return null;

  let data: LifecycleData | null = null;
  try {
    data = JSON.parse(lifecycleComment) as LifecycleData;
  } catch {
    return null;
  }

  // 데이터가 있는 단계만 표시
  const visiblePhases = PHASE_CONFIG.filter(p => data![p.key]?.trim());
  if (visiblePhases.length === 0) return null;

  return (
    <div className="mb-6">
      {/* 토글 헤더 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-card border border-border-default rounded-xl hover:bg-bg-secondary/40 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm">📈</span>
          <span className="text-sm font-semibold text-text-primary">
            {t("LIFECYCLE_SECTION_TITLE")}
          </span>
          <span className="text-xs text-text-muted">
            {t("LIFECYCLE_PHASE_COUNT", { n: String(visiblePhases.length) })}
          </span>
        </span>
        <span className="text-xs text-text-muted">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* 펼침: 단계별 카드 */}
      {expanded && (
        <div className={`mt-2 grid gap-3 ${visiblePhases.length === 1 ? "grid-cols-1" : visiblePhases.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-3"}`}>
          {visiblePhases.map(phase => (
            <div
              key={phase.key}
              className={`rounded-xl border px-4 py-4 ${phase.colorBg} ${phase.colorBorder}`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{phase.icon}</span>
                <span className={`text-xs font-semibold ${phase.colorTitle}`}>
                  {t(phase.labelKey)}
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {data![phase.key]}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
