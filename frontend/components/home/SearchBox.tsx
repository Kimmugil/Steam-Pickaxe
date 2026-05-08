"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";
import { getSteamLabel } from "@/components/shared/Badge";

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
  const [registeredName, setRegisteredName] = useState<string | null>(null);
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
      show("이미 등록된 게임입니다. 상세 페이지로 이동합니다.", "info");
      setTimeout(() => router.push(`/game/${data.appid}`), 1200);
      return;
    }
    if (data.error === "not_game") {
      show("게임 타입의 앱만 등록 가능합니다.", "warning");
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
      show(`${result.name} 등록 완료! 분석이 시작됩니다.`, "success");
      setRegisteredName(result.name);
      setResult(null);
      setQuery("");
      router.refresh();
    } else if (data.quota_exceeded) {
      show(t("REGISTER_QUOTA_EXCEEDED"), "error");
    } else {
      show(data.error ?? "등록 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="w-full">
      {/* 검색창 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={"게임명, AppID, 또는 스팀 상점 URL 입력"}
          className="flex-1 bg-bg-card border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </form>

      {/* 한글 검색 안내 */}
      <p className="mt-2 text-xs text-text-muted">
        {"스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다."}
      </p>

      {/* 등록 완료 안내 */}
      {registeredName && (
        <div className="mt-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-accent-blue mb-0.5">
            {registeredName} 등록이 완료되었습니다.
          </p>
          <p className="text-xs text-text-secondary">
            {t("REGISTER_APPROVAL_NOTICE")}
          </p>
        </div>
      )}

      {notFound && (
        <p className="mt-3 text-text-muted text-sm">
          {"검색 결과를 찾을 수 없습니다."}
        </p>
      )}

      {/* ── 검색 결과 카드: 컴팩트 가로형 ───────────────────────── */}
      {result && (
        <div className="mt-4 bg-bg-card border border-accent-blue/30 rounded-xl overflow-hidden flex items-center gap-3 p-3">
          {/* 썸네일 */}
          {result.thumbnail && (
            <div className="relative w-28 h-14 flex-shrink-0 rounded overflow-hidden bg-bg-secondary">
              <Image
                src={result.thumbnail}
                alt={result.name}
                fill
                className="object-cover object-center"
                sizes="112px"
              />
            </div>
          )}

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary text-sm truncate">{result.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-nowrap overflow-hidden">
              <span className="text-xs text-text-muted whitespace-nowrap">AppID {result.appid}</span>
              {result.release_date && (
                <span className="text-xs text-text-muted whitespace-nowrap">{result.release_date}</span>
              )}
              {result.developers && result.developers.length > 0 && (
                <span className="text-xs text-text-muted truncate">{result.developers[0]}</span>
              )}
              {result.positiveRate !== undefined && result.totalReviews !== undefined && (
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {result.totalReviews.toLocaleString()}건
                  <span className="mx-1">·</span>
                  <span className="text-text-secondary font-medium">
                    {getSteamLabel(result.positiveRate, result.totalReviews)}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* 등록 버튼 — 오른쪽 고정 */}
          <button
            onClick={handleRegister}
            disabled={registering}
            className="flex-shrink-0 px-3 py-1.5 bg-accent-green/20 border border-accent-green/40 text-accent-green rounded-lg text-xs font-medium hover:bg-accent-green/30 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {registering ? "등록 중..." : "이 게임 분석 등록하기"}
          </button>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
