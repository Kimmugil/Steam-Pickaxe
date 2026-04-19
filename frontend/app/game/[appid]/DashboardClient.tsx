"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Header from "@/components/dashboard/Header";
import CcuChart from "@/components/dashboard/CcuChart";
import CcuAdminPanel from "@/components/dashboard/CcuAdminPanel";
import SentimentChart from "@/components/dashboard/SentimentChart";
import LanguageTab from "@/components/dashboard/LanguageTab";
import Timeline from "@/components/dashboard/Timeline";
import EventForm from "@/components/dashboard/EventForm";
import ChatBot from "@/components/chatbot/ChatBot";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game, TimelineRow, CcuRow } from "@/types";

type Tab = "ccu" | "sentiment" | "language";

interface Props {
  game: Game;
  timelineRows: TimelineRow[];
  ccuRows: CcuRow[];
  allGames: Game[];
  currentCcu?: number;
  topSentimentRate?: number;
  topLanguages: string[];
}

export default function DashboardClient({
  game, timelineRows, ccuRows, allGames,
  currentCcu, topSentimentRate, topLanguages,
}: Props) {
  const router = useRouter();
  const { t } = useUiText();
  const { toast, show, clear } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("ccu");
  const [compareCcuData, setCompareCcuData] = useState<CcuRow[]>([]);
  const [compareGame, setCompareGame] = useState<Game | null>(null);

  // 게임 삭제
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI 분석 새로고침
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // CCU 피크타임 AI 코멘트
  const peaktimeComment = timelineRows
    .filter((r) => r.language_scope === "all")
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.ai_reaction_summary ?? "";

  // 언어권 교차 분석 코멘트
  const crossComment = timelineRows
    .filter((r) => r.language_scope === "all" && r.ai_reaction_summary)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.ai_reaction_summary ?? "";

  async function handleCompareSelect(appid: string) {
    const found = allGames.find((g) => String(g.appid) === appid);
    setCompareGame(found ?? null);
    const res = await fetch(`/api/game/${appid}/ccu`);
    const data: CcuRow[] = await res.json();
    setCompareCcuData(data);
    setActiveTab("ccu");
  }

  async function handleReanalyze(password: string) {
    setReanalyzing(true);
    setShowReanalyzeModal(false);
    const res = await fetch("/api/admin/reanalyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setReanalyzing(false);
    if (data.ok) {
      show(t("REANALYZE_SUCCESS"), "success");
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  async function handleDelete(password: string) {
    setDeleting(true);
    setShowDeleteModal(false);
    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: String(game.appid), password }),
    });
    const data = await res.json();
    setDeleting(false);
    if (data.ok) {
      show(t("DELETE_SUCCESS"), "success");
      setTimeout(() => router.push("/"), 1000);
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  const TABS: { key: Tab; labelKey: string }[] = [
    { key: "ccu",       labelKey: "TAB_CCU" },
    { key: "sentiment", labelKey: "TAB_SENTIMENT" },
    { key: "language",  labelKey: "TAB_LANGUAGE" },
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
                  topLanguages={topLanguages}
                  peaktimeComment={peaktimeComment}
                  currentPeakCcu={Number(game.peak_ccu)}
                  compareGame={
                    compareGame && compareCcuData.length > 0
                      ? { name: compareGame.name_kr || compareGame.name, data: compareCcuData, peakCcu: Number(compareGame.peak_ccu) }
                      : undefined
                  }
                />
                <CcuAdminPanel
                  currentAppId={String(game.appid)}
                  games={allGames}
                  onCompareSelect={handleCompareSelect}
                  onCsvUploaded={() => router.refresh()}
                />
              </>
            )}
            {activeTab === "sentiment" && (
              <SentimentChart timelineRows={timelineRows} topLanguages={topLanguages} />
            )}
            {activeTab === "language" && (
              <LanguageTab timelineRows={timelineRows} crossAnalysisComment={crossComment} />
            )}
          </div>
        </div>

        {/* ── 업데이트 히스토리 ────────────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6">
          <h2 className="text-base font-semibold text-text-primary mb-6">{t("HISTORY_TITLE")}</h2>
          <EventForm appid={String(game.appid)} onEventAdded={() => router.refresh()} />
          <Timeline timelineRows={timelineRows} appid={String(game.appid)} />
        </div>

        {/* ── 관리자 액션 (재분석 + 삭제) ────────────────────────── */}
        <div className="flex gap-4 items-stretch">

          {/* AI 분석 새로고침 */}
          <div className="flex-1 bg-bg-card border border-accent-blue/20 rounded-xl p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-accent-blue/80 mb-1">{t("REANALYZE_TITLE")}</h3>
            <p className="text-xs text-text-muted mb-3 flex-1">{t("REANALYZE_DESC")}</p>
            <button
              onClick={() => setShowReanalyzeModal(true)}
              disabled={reanalyzing}
              className="w-full py-2 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue/80 rounded-lg text-sm hover:bg-accent-blue/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Lock className="w-3.5 h-3.5" />
              {reanalyzing ? t("REANALYZE_BTN_LOADING") : t("REANALYZE_BTN")}
            </button>
          </div>

          {/* 게임 삭제 */}
          <div className="flex-1 bg-bg-card border border-accent-red/20 rounded-xl p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-accent-red/80 mb-1">{t("DELETE_TITLE")}</h3>
            <p className="text-xs text-text-muted mb-3 flex-1">{t("DELETE_DESC")}</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red/70 rounded-lg text-sm hover:bg-accent-red/20 transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                {t("DELETE_BTN")}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">{t("DELETE_SOFT_NOTICE")}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={deleting}
                    className="flex-1 py-2 bg-accent-red/20 border border-accent-red/40 text-accent-red rounded-lg text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {deleting ? t("DELETE_BTN_LOADING") : t("DELETE_CONFIRM_BTN")}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
                  >
                    {t("DELETE_CANCEL_BTN")}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 모달들 */}
      <AdminPasswordModal
        isOpen={showReanalyzeModal}
        title={t("REANALYZE_TITLE")}
        description={t("REANALYZE_AUTH_DESC")}
        loading={reanalyzing}
        onConfirm={handleReanalyze}
        onClose={() => setShowReanalyzeModal(false)}
      />
      <AdminPasswordModal
        isOpen={showDeleteModal}
        title={t("DELETE_AUTH_TITLE")}
        description={`"${game.name_kr || game.name}"을(를) 홈 화면에서 숨깁니다. 데이터는 보존됩니다.`}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setShowDeleteModal(false)}
      />

      <ChatBot game={game} timelineRows={timelineRows} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
