"use client";

interface BadgeProps {
  rate: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getSentimentColor(rate: number) {
  if (rate >= 80) return "text-accent-green bg-accent-green/10 border-accent-green/30";
  if (rate >= 70) return "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30";
  if (rate >= 40) return "text-accent-orange bg-accent-orange/10 border-accent-orange/30";
  return "text-accent-red bg-accent-red/10 border-accent-red/30";
}

function getSentimentLabel(rate: number) {
  if (rate >= 95) return "압도적으로 긍정적";
  if (rate >= 80) return "매우 긍정적";
  if (rate >= 70) return "긍정적";
  if (rate >= 40) return "복합적";
  if (rate >= 20) return "대체로 부정적";
  return "압도적으로 부정적";
}

export default function Badge({ rate, size = "md", showLabel = false }: BadgeProps) {
  const color = getSentimentColor(rate);
  const label = getSentimentLabel(rate);
  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : size === "lg" ? "text-sm px-3 py-1.5" : "text-xs px-2 py-1";

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-medium ${color} ${sizeClass}`}>
      {showLabel ? label : null}
      <span>{rate}%</span>
    </span>
  );
}

export function SentimentLabel({ rate }: { rate: number }) {
  const color = getSentimentColor(rate);
  const label = getSentimentLabel(rate);
  return (
    <span className={`text-xs font-medium ${color.split(" ")[0]}`}>{label}</span>
  );
}
