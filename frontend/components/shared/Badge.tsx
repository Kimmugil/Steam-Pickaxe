"use client";

interface BadgeProps {
  rate: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * Steam 9단계 평가 시스템
 *
 * 긍정 (80%+):
 *   압도적으로 긍정적  95%+, 500개+
 *   매우 긍정적        80%+, 50개+
 *   긍정적            80%+, 10개+
 *
 * 중립 구간:
 *   대체로 긍정적      70–79%, 10개+
 *   복합적            40–69%, 10개+
 *   대체로 부정적      20–39%, 10개+
 *
 * 부정 (0–19%):
 *   압도적으로 부정적  500개+
 *   매우 부정적        50개+
 *   부정적            10개+
 *
 * 리뷰 수가 10 미만이면 rate만으로 단순 레이블 표시.
 */
function getSteamTier(rate: number, count: number): {
  label: string;
  color: string;
} {
  if (count >= 10) {
    // 긍정 계열
    if (rate >= 95 && count >= 500) return { label: "압도적으로 긍정적", color: "text-accent-green bg-accent-green/10 border-accent-green/30" };
    if (rate >= 80 && count >= 50)  return { label: "매우 긍정적",        color: "text-accent-green bg-accent-green/10 border-accent-green/30" };
    if (rate >= 80)                  return { label: "긍정적",             color: "text-accent-green bg-accent-green/10 border-accent-green/30" };
    // 중립 계열
    if (rate >= 70)                  return { label: "대체로 긍정적",      color: "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30" };
    if (rate >= 40)                  return { label: "복합적",             color: "text-accent-orange bg-accent-orange/10 border-accent-orange/30" };
    if (rate >= 20)                  return { label: "대체로 부정적",      color: "text-accent-orange bg-accent-orange/10 border-accent-orange/30" };
    // 부정 계열
    if (count >= 500)               return { label: "압도적으로 부정적",   color: "text-accent-red bg-accent-red/10 border-accent-red/30" };
    if (count >= 50)                return { label: "매우 부정적",         color: "text-accent-red bg-accent-red/10 border-accent-red/30" };
    return                                 { label: "부정적",              color: "text-accent-red bg-accent-red/10 border-accent-red/30" };
  }

  // 리뷰 수 부족 — rate 기반 단순 표시
  if (rate >= 80) return { label: "긍정적",        color: "text-accent-green bg-accent-green/10 border-accent-green/30" };
  if (rate >= 70) return { label: "대체로 긍정적", color: "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30" };
  if (rate >= 40) return { label: "복합적",        color: "text-accent-orange bg-accent-orange/10 border-accent-orange/30" };
  return                 { label: "부정적",        color: "text-accent-red bg-accent-red/10 border-accent-red/30" };
}

export default function Badge({ rate, reviewCount, size = "md", showLabel = false }: BadgeProps) {
  const { label, color } = getSteamTier(rate, reviewCount ?? 0);
  const sizeClass =
    size === "sm" ? "text-xs px-1.5 py-0.5" :
    size === "lg" ? "text-sm px-3 py-1.5" :
    "text-xs px-2 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-medium ${color} ${sizeClass}`}>
      {showLabel ? <span>{label}</span> : null}
      <span>{rate}%</span>
    </span>
  );
}

export function SentimentLabel({ rate, reviewCount }: { rate: number; reviewCount?: number }) {
  const { label, color } = getSteamTier(rate, reviewCount ?? 0);
  return (
    <span className={`text-xs font-medium ${color.split(" ")[0]}`}>{label}</span>
  );
}
