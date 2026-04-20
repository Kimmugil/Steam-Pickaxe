"use client";

interface BadgeProps {
  rate: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;  // label + rate% 함께 표시
  labelOnly?: boolean;  // 스팀 평가 용어만 표시 (% 숫자 없음)
  overlay?: boolean;    // 썸네일 이미지 위에 올릴 때: 어두운 불투명 배경
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
function getSteamTier(rate: number, count: number, overlay = false): {
  label: string;
  color: string;
} {
  // overlay=true: 이미지 위 가독성을 위해 진한 반투명 어두운 배경 사용
  const G = overlay
    ? "text-accent-green  bg-black/75 border-accent-green/60"
    : "text-accent-green  bg-accent-green/10  border-accent-green/30";
  const Y = overlay
    ? "text-accent-yellow bg-black/75 border-accent-yellow/60"
    : "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30";
  const O = overlay
    ? "text-accent-orange bg-black/75 border-accent-orange/60"
    : "text-accent-orange bg-accent-orange/10 border-accent-orange/30";
  const R = overlay
    ? "text-accent-red    bg-black/75 border-accent-red/60"
    : "text-accent-red    bg-accent-red/10    border-accent-red/30";

  if (count >= 10) {
    if (rate >= 95 && count >= 500) return { label: "압도적으로 긍정적", color: G };
    if (rate >= 80 && count >= 50)  return { label: "매우 긍정적",        color: G };
    if (rate >= 80)                  return { label: "긍정적",             color: G };
    if (rate >= 70)                  return { label: "대체로 긍정적",      color: Y };
    if (rate >= 40)                  return { label: "복합적",             color: O };
    if (rate >= 20)                  return { label: "대체로 부정적",      color: O };
    if (count >= 500)               return { label: "압도적으로 부정적",   color: R };
    if (count >= 50)                return { label: "매우 부정적",         color: R };
    return                                 { label: "부정적",              color: R };
  }

  // 리뷰 수 부족 — rate 기반 단순 표시
  if (rate >= 80) return { label: "긍정적",        color: G };
  if (rate >= 70) return { label: "대체로 긍정적", color: Y };
  if (rate >= 40) return { label: "복합적",        color: O };
  return                 { label: "부정적",        color: R };
}

/** Badge 컴포넌트 외부에서 평가 레이블만 필요할 때 사용 */
export function getSteamLabel(rate: number, reviewCount = 0): string {
  return getSteamTier(rate, reviewCount).label;
}

export default function Badge({
  rate,
  reviewCount,
  size = "md",
  showLabel = false,
  labelOnly = false,
  overlay = false,
}: BadgeProps) {
  const { label, color } = getSteamTier(rate, reviewCount ?? 0, overlay);
  const sizeClass =
    size === "sm" ? "text-xs px-1.5 py-0.5" :
    size === "lg" ? "text-sm px-3 py-1.5" :
    "text-xs px-2 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-medium whitespace-nowrap ${color} ${sizeClass}`}>
      {labelOnly ? (
        <span>{label}</span>
      ) : (
        <>
          {showLabel && <span>{label}</span>}
          <span>{rate}%</span>
        </>
      )}
    </span>
  );
}

export function SentimentLabel({ rate, reviewCount }: { rate: number; reviewCount?: number }) {
  const { label, color } = getSteamTier(rate, reviewCount ?? 0);
  return (
    <span className={`text-xs font-medium ${color.split(" ")[0]}`}>{label}</span>
  );
}
