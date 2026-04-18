"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";

interface SearchResult {
  appid: string;
  name: string;
  thumbnail: string;
  type: string;
  totalReviews?: number;
  positiveRate?: number;
  release_date?: string;
  developers?: string[];
  publishers?: string[];
}

/** Steam Store URL에서 AppID를 추출합니다. 없으면 null 반환. */
function extractAppIdFromUrl(input: string): string | null {
  const match = input.match(/store\.steampowered\.com\/app\/(\d+)/);
  return match ? match[1] : null;
}

export default function SearchBox() {
  const { t } = useUiText();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { toast, show, clear } = useToast();
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;

    const extracted = extractAppIdFromUrl(raw);
    const searchQuery = extracted ?? raw;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setLoading(false);

    if (data.error === "already_registered") {
      show(t("SEARCH_ALREADY_REGISTERED"), "info");
      setTimeout(() => router.push(`/game/${data.appid}`), 1200);
      return;
    }
    if (data.error === "not_game") {
      show(t("SEARCH_NOT_GAME"), "warning");
      return;
    }
    if (!data.appid) {
      setNotFound(true);
      return;
    }
    setResult(data);
  }

  async function handleRegister() {
    if (!result) return;
    setRegistering(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appid: result.appid,
        name: result.name,
        thumbnail: result.thumbnail,
      }),
    });
    const data = await res.json();
    setRegistering(false);

    if (data.ok) {
      show(t("REGISTER_SUCCESS", { name: result.name }), "success");
      setResult(null);
      setQuery("");
      // 즉시 서버 데이터 갱신 → 대기열에 바로 표시
      router.refresh();
    } else if (data.quota_exceeded) {
      show(t("REGISTER_QUOTA_EXCEEDED"), "error");
    } else {
      show(data.error ?? t("REGISTER_ERROR"), "error");
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 검색창 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("SEARCH_PLACEHOLDER")}
          className="flex-1 bg-bg-card border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t("SEARCH_BTN_LOADING") : t("SEARCH_BTN")}
        </button>
      </form>

      {/* 한글 검색 안내 */}
      <p className="mt-2 text-xs text-text-muted text-center">
        {t("SEARCH_HINT")}
      </p>

      {notFound && (
        <p className="mt-3 text-text-muted text-sm text-center">
          {t("SEARCH_NOT_FOUND")}
        </p>
      )}

      {/* ── 검색 결과 카드: 가로(flex-row) 레이아웃 ──────────────────────── */}
      {result && (
        <div className="mt-4 bg-bg-card border border-border-default rounded-xl overflow-hidden flex flex-row">

          {/* 왼쪽: 썸네일 — 고정 너비, 460:215 비율 유지 */}
          <div className="relative w-[220px] shrink-0 bg-bg-secondary self-stretch">
            <Image
              src={result.thumbnail}
              alt={result.name}
              fill
              className="object-cover"
              sizes="220px"
            />
          </div>

          {/* 가운데: 게임 정보 */}
          <div className="flex-1 min-w-0 px-4 py-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              {/* 게임명 */}
              <p className="font-bold text-text-primary text-base leading-snug">
                {result.name}
              </p>

              {/* 메타데이터 목록 */}
              <div className="space-y-0.5">
                <p className="text-xs text-text-secondary">
                  <span className="text-text-muted">{t("RESULT_LABEL_APPID")}:</span>{" "}
                  {result.appid}
                </p>

                {result.release_date && (
                  <p className="text-xs text-text-secondary">
                    <span className="text-text-muted">{t("RESULT_LABEL_RELEASE")}:</span>{" "}
                    {result.release_date}
                  </p>
                )}

                {result.developers && result.developers.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    <span className="text-text-muted">{t("RESULT_LABEL_DEVELOPER")}:</span>{" "}
                    {result.developers.join(", ")}
                  </p>
                )}

                {result.publishers &&
                  result.publishers.length > 0 &&
                  result.publishers.join(",") !== result.developers?.join(",") && (
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-muted">{t("RESULT_LABEL_PUBLISHER")}:</span>{" "}
                      {result.publishers.join(", ")}
                    </p>
                  )}

                {result.positiveRate !== undefined &&
                  result.totalReviews !== undefined && (
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-muted">{t("RESULT_LABEL_POSITIVE_RATE")}:</span>{" "}
                      {result.positiveRate}%
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-muted">{t("RESULT_LABEL_REVIEWS")}:</span>{" "}
                      {result.totalReviews.toLocaleString()}건
                    </p>
                  )}
              </div>
            </div>

            {/* 오른쪽 하단: 등록 버튼 */}
            <button
              onClick={handleRegister}
              disabled={registering}
              className="self-start px-4 py-2 bg-accent-green/20 border border-accent-green/40 text-accent-green rounded-lg text-sm font-medium hover:bg-accent-green/30 disabled:opacity-40 transition-colors"
            >
              {registering ? t("REGISTER_BTN_LOADING") : t("REGISTER_BTN")}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
