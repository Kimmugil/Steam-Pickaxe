"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";

interface SearchResult {
  appid: string;
  name: string;
  thumbnail: string;
  early_access: boolean;
  alreadyRegistered: boolean;
}

interface Props {
  onClose: () => void;
}

export default function SearchModal({ onClose }: Props) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const { t } = useUiText();

  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState<SearchResult[] | null>(null);
  const [registering, setRegistering] = useState<string | null>(null); // appid 중

  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때 input 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);
    try {
      const res  = await fetch(`/api/search-multi?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      show(t("SEARCH_ERROR"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(result: SearchResult) {
    setRegistering(result.appid);
    try {
      const res  = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appid: result.appid, name: result.name, thumbnail: result.thumbnail }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("REGISTER_SUCCESS", { name: result.name }), "success");
        // 등록된 항목 alreadyRegistered 상태로 업데이트
        setResults((prev) =>
          prev?.map((r) => r.appid === result.appid ? { ...r, alreadyRegistered: true } : r) ?? null
        );
        router.refresh();
      } else if (data.quota_exceeded) {
        show(t("REGISTER_QUOTA_EXCEEDED"), "error");
      } else {
        show(data.error ?? t("REGISTER_ERROR"), "error");
      }
    } catch {
      show(t("SEARCH_SERVER_ERROR"), "error");
    } finally {
      setRegistering(null);
    }
  }

  return (
    <>
      {/* 딤드 백드롭 — z-40 으로 설정해 z-50 Navbar 위에 덮이지 않음 */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 컨테이너 — 내비게이션 바(h-14) 아래부터 시작 */}
      <div className="fixed inset-0 z-40 overflow-y-auto pointer-events-none" style={{ top: 56 }}>
        <div className="min-h-full flex flex-col items-center px-4 pt-10 pb-16">
          <div
            className="w-full max-w-3xl pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── 검색바 ─────────────────────────────────────────────── */}
            <form onSubmit={handleSearch} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("SEARCH_PLACEHOLDER")}
                className="w-full bg-bg-card border-2 border-accent-blue/60 rounded-2xl px-6 py-4 pr-32 text-text-primary text-lg placeholder:text-text-muted focus:outline-none focus:border-accent-blue shadow-2xl transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-accent-blue text-white rounded-xl font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors text-sm"
              >
                {loading ? t("SEARCH_BTN_LOADING") : t("SEARCH_BTN")}
              </button>
            </form>
            <p className="mt-2 text-xs text-text-muted text-center">
              {t("SEARCH_HINT")}
            </p>

            {/* ── 검색 결과 ──────────────────────────────────────────── */}
            {loading && (
              <div className="mt-10 text-center text-text-muted text-sm animate-pulse">
                {t("SEARCH_LOADING_TEXT")}
              </div>
            )}

            {results && results.length === 0 && (
              <div className="mt-10 text-center text-text-muted text-sm">
                {t("SEARCH_NO_RESULTS")}
              </div>
            )}

            {results && results.length > 0 && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((r) => (
                  <SearchResultCard
                    key={r.appid}
                    result={r}
                    registering={registering === r.appid}
                    onRegister={() => handleRegister(r)}
                    t={t}
                  />
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </>
  );
}

// ── 검색 결과 카드 ──────────────────────────────────────────────────────────

function SearchResultCard({
  result, registering, onRegister, t,
}: {
  result: SearchResult;
  registering: boolean;
  onRegister: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`bg-bg-card border rounded-xl overflow-hidden flex flex-col transition-all ${
      result.alreadyRegistered
        ? "border-border-default opacity-60"
        : "border-border-default hover:border-border-hover hover:shadow-lg hover:shadow-black/30"
    }`}>
      {/* 썸네일 */}
      <div className="relative aspect-[460/215] w-full overflow-hidden bg-bg-secondary">
        {!imgError ? (
          <Image
            src={result.thumbnail}
            alt={result.name}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
            이미지 없음
          </div>
        )}
        {/* 얼리 액세스 배지 */}
        {result.early_access && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 border border-accent-orange/50 text-accent-orange">
            {t("EARLY_ACCESS_BADGE")}
          </span>
        )}
        {/* 이미 등록됨 오버레이 */}
        {result.alreadyRegistered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-xs font-semibold text-white bg-black/60 px-3 py-1.5 rounded-full">
              {t("ALREADY_REGISTERED_BADGE")}
            </span>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="p-3 flex-1">
        <p className="font-semibold text-text-primary text-sm truncate">{result.name}</p>
        <p className="text-xs text-text-muted mt-0.5">{t("RESULT_LABEL_APPID")} {result.appid}</p>
      </div>

      {/* 등록 버튼 */}
      <div className="px-3 pb-3">
        {result.alreadyRegistered ? (
          <div className="w-full py-2 text-center text-xs text-text-muted border border-border-default rounded-lg">
            {t("ALREADY_REGISTERED_BTN")}
          </div>
        ) : (
          <button
            onClick={onRegister}
            disabled={registering}
            className="w-full py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40
              border-accent-green/40 text-accent-green bg-accent-green/5 hover:bg-accent-green/15"
          >
            {registering ? t("REGISTER_BTN_LOADING") : t("REGISTER_BTN")}
          </button>
        )}
      </div>
    </div>
  );
}
