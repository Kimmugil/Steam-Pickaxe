"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";

interface SearchResult {
  appid: string;
  name: string;
  thumbnail: string;
  type: string;
  totalReviews?: number;
  positiveRate?: number;
}

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { toast, show, clear } = useToast();
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);

    const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
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
      body: JSON.stringify({ appid: result.appid, name: result.name, thumbnail: result.thumbnail }),
    });
    const data = await res.json();
    setRegistering(false);

    if (data.ok) {
      show(`${result.name} 등록 완료! 수집이 시작됩니다.`, "success");
      setResult(null);
      setQuery("");
      setTimeout(() => router.refresh(), 1500);
    } else {
      show(data.error ?? "등록 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="게임명 또는 AppID 입력"
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

      {notFound && (
        <p className="mt-3 text-text-muted text-sm text-center">검색 결과를 찾을 수 없습니다.</p>
      )}

      {result && (
        <div className="mt-4 bg-bg-card border border-border-default rounded-xl p-4 flex items-center gap-4">
          <Image
            src={result.thumbnail}
            alt={result.name}
            width={120}
            height={45}
            className="rounded-md object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">{result.name}</p>
            <p className="text-xs text-text-secondary mt-1">AppID: {result.appid}</p>
            {result.positiveRate !== undefined && result.totalReviews !== undefined && (
              <p className="text-xs text-text-secondary mt-0.5">
                긍정률 {result.positiveRate}% · 리뷰 {result.totalReviews.toLocaleString()}건
              </p>
            )}
          </div>
          <button
            onClick={handleRegister}
            disabled={registering}
            className="shrink-0 px-4 py-2 bg-accent-green/20 border border-accent-green/40 text-accent-green rounded-lg text-sm font-medium hover:bg-accent-green/30 disabled:opacity-40 transition-colors"
          >
            {registering ? "등록 중..." : "이 게임 분석 등록하기"}
          </button>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
