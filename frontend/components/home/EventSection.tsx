"use client";
import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

export default function EventSection({ games }: { games: Game[] }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useUiText();

  function fmtRelative(d: string | undefined): string {
    if (!d) return "";
    const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (n === 0) return t("REL_TODAY");
    if (n <= 7)  return t("REL_DAYS_AGO",   { n: String(n) });
    if (n <= 30) return t("REL_WEEKS_AGO",  { n: String(Math.ceil(n / 7)) });
    return          t("REL_MONTHS_AGO", { n: String(Math.ceil(n / 30)) });
  }

  return (
    <>
      {/* 헤더 (토글 버튼) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-secondary/40 transition-colors text-left"
      >
        <h3 className="text-sm font-semibold text-text-primary border-l-2 border-accent-blue pl-2.5">{t("INSIGHT_EVENT_TITLE")}</h3>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          {t("INSIGHT_EVENT_RECENT")} <span className="text-text-primary font-semibold">{games.length}{t("COUNT_SUFFIX")}</span>
          <span className="text-[10px]">{expanded ? "▲" : "▼"}</span>
        </span>
      </button>

      {/* 펼침 목록 */}
      {expanded && (
        <div>
          {games.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-muted text-center">{t("INSIGHT_EVENT_EMPTY")}</p>
          ) : (
            games.map((g) => {
              const externalUrl = g.latest_official_event_url;
              const inner = (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-text-primary truncate flex-1 min-w-0">{g.name_kr || g.name}</p>
                    <span className="flex-shrink-0 text-[9px] font-medium text-accent-blue border border-accent-blue/25 bg-accent-blue/10 px-1.5 py-0.5 rounded">
                      {t("EVENT_TYPE_OFFICIAL")}
                    </span>
                  </div>
                  {g.latest_official_event_title && (
                    <p className="text-[10px] text-text-muted truncate mt-0.5">{g.latest_official_event_title}</p>
                  )}
                  <p className="text-[10px] text-text-muted/70 mt-0.5">{fmtRelative(g.latest_official_event_date)}</p>
                </div>
              );

              return externalUrl ? (
                <a
                  key={g.appid}
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={g.appid}
                  href={`/game/${g.appid}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
                >
                  {inner}
                </Link>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
