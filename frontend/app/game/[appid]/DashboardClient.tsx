"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/dashboard/Header";
import CcuChart from "@/components/dashboard/CcuChart";
import CcuAdminPanel from "@/components/dashboard/CcuAdminPanel";
import SentimentChart from "@/components/dashboard/SentimentChart";
import LanguageTab from "@/components/dashboard/LanguageTab";
import PlaytimeTab from "@/components/dashboard/PlaytimeTab";
import Timeline from "@/components/dashboard/Timeline";
import EventForm from "@/components/dashboard/EventForm";
import { Lock } from "lucide-react";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game, TimelineRow, CcuRow } from "@/types";

type Tab = "ccu" | "sentiment" | "language" | "playtime";

interface Props {
  game: Game;
  timelineRows: TimelineRow[];
  ccuRows: CcuRow[];
  currentCcu?: number;
  topSentimentRate?: number;
  topLanguages: string[];
}

export default function DashboardClient({
  game, timelineRows, ccuRows,
  currentCcu, topSentimentRate, topLanguages,
}: Props) {
  const router = useRouter();
  const { t } = useUiText();
  const [activeTab, setActiveTab] = useState<Tab>("ccu");
  const [showEventModal, setShowEventModal] = useState(false);

  const languageDistribution = useMemo<Record<string, number>>(() => {
    try {
      return game.language_distribution ? JSON.parse(game.language_distribution) : {};
    } catch {
      return {};
    }
  }, [game.language_distribution]);

  const TABS: { key: Tab; labelKey: string }[] = [
    { key: "ccu",       labelKey: "TAB_CCU" },
    { key: "sentiment", labelKey: "TAB_SENTIMENT" },
    { key: "language",  labelKey: "TAB_LANGUAGE" },
    { key: "playtime",  labelKey: "TAB_PLAYTIME" },
  ];

  return (
    <div>
      <Header game={game} currentCcu={currentCcu} topSentimentRate={topSentimentRate} />

      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

        {/* ── 차트 탭 ─────────────────────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
          <div className="flex border-b border-border-default">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-accent-blue border-b-2 border-accent-blue"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "ccu" && (
              <>
                <CcuChart
                  data={ccuRows}
                  peaktimeComment={game.ccu_peaktime_comment}
                />
                <CcuAdminPanel
                  currentAppId={String(game.appid)}
                  gameName={game.name_kr || game.name}
                  onCsvUploaded={() => router.refresh()}
                />
              </>
            )}
            {activeTab === "sentiment" && (
              <SentimentChart
                timelineRows={timelineRows}
                topLanguages={topLanguages}
                sentimentTrendComment={game.sentiment_trend_comment}
                shiftRows={timelineRows.filter(r => r.event_type === "sentiment_shift")}
              />
            )}
            {activeTab === "language" && (
              <LanguageTab
                timelineRows={timelineRows}
                crossAnalysisComment={game.language_cross_comment}
                languageDistribution={languageDistribution}
                appid={String(game.appid)}
              />
            )}
            {activeTab === "playtime" && (
              <PlaytimeTab
                playtimeStats={game.playtime_stats}
                playtimeStatsDate={game.playtime_stats_date}
              />
            )}
          </div>
        </div>

        {/* ── 업데이트 히스토리 ────────────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6">
          <h2 className="text-base font-semibold text-text-primary mb-6">{t("HISTORY_TITLE")}</h2>
          <Timeline timelineRows={timelineRows} appid={String(game.appid)} releaseDate={game.release_date} />

          {/* 수동 이벤트 등록 버튼 */}
          <div className="mt-6 pt-4 border-t border-border-default">
            <button
              onClick={() => setShowEventModal(true)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <Lock className="w-3 h-3" />
              수동 이슈/이벤트 등록 (관리자)
            </button>
          </div>
        </div>

      </div>

      {/* 수동 이벤트 등록 모달 */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-[520px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary text-sm">{t("EVENT_FORM_TOGGLE")}</h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-text-muted hover:text-text-primary text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <EventForm
              appid={String(game.appid)}
              onEventAdded={() => { router.refresh(); setShowEventModal(false); }}
              inModal
            />
          </div>
        </div>
      )}

    </div>
  );
}
