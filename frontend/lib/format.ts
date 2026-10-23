export const DIAG: Record<string, { cls: "good" | "warn" | "bad" | "cool"; key: string }> = {
  healthy: { cls: "good", key: "diag_healthy" },
  quiet: { cls: "warn", key: "diag_quiet" },
  angry: { cls: "bad", key: "diag_angry" },
  cool: { cls: "cool", key: "diag_cool" },
};

export const TIER_LABEL: Record<string, string> = { hot: "뜨거움", mid: "보통", calm: "잔잔함", idle: "휴면" };
export const TIER_RULE: Record<string, string> = { hot: "매일", mid: "3일마다", calm: "10일마다", idle: "한 달에 한 번" };

export function sign(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const v = Number(n.toFixed(digits));
  return (v > 0 ? "+" : "") + v;
}

export function trendClass(n: number | null | undefined): "up" | "down" | "flat" {
  if (n === null || n === undefined) return "flat";
  return n > 1 ? "up" : n < -1 ? "down" : "flat";
}

export function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "-" : Number(n).toLocaleString("ko-KR");
}

/** "2026-10-22T08:00:00Z" → "10/22 17:00" (한국 시간) */
export function kst(iso: string | Date | null | undefined, withTime = true): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return withTime ? `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}` : `${g("month")}/${g("day")}`;
}

export function ago(iso: string | Date | null | undefined): string {
  if (!iso) return "기록 없음";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}시간 전`;
  return `${Math.round(mins / 1440)}일 전`;
}

export function daysFromNow(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

export const LANGUAGE_NAMES: Record<string, string> = {
  koreana: "한국어", english: "영어", schinese: "중국어(간체)", tchinese: "중국어(번체)", japanese: "일본어", russian: "러시아어",
  french: "프랑스어", german: "독일어", spanish: "스페인어", latam: "스페인어(중남미)", brazilian: "포르투갈어(브라질)",
  portuguese: "포르투갈어", turkish: "터키어", polish: "폴란드어", thai: "태국어", vietnamese: "베트남어", italian: "이탈리아어",
  ukrainian: "우크라이나어", czech: "체코어", hungarian: "헝가리어", dutch: "네덜란드어", swedish: "스웨덴어", finnish: "핀란드어",
  danish: "덴마크어", norwegian: "노르웨이어", romanian: "루마니아어", bulgarian: "불가리아어", greek: "그리스어", arabic: "아랍어",
};
export const langName = (c: string) => LANGUAGE_NAMES[c] ?? c;

export const SCOPE_LABEL: Record<string, string> = { all: "전체" };
