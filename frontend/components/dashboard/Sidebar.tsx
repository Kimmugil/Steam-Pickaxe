"use client";
import { useState, useRef } from "react";
import type { Game } from "@/types";
import Toast, { useToast } from "@/components/shared/Toast";

interface SidebarProps {
  currentAppId: string;
  games: Game[];
  onCompareSelect: (appid: string) => void;
  onEventAdded: () => void;
  onDeleted: () => void;
}

export default function Sidebar({
  currentAppId, games, onCompareSelect, onEventAdded, onDeleted,
}: SidebarProps) {
  const { toast, show, clear } = useToast();
  const [selectedCompare, setSelectedCompare] = useState("");

  // 수동 이벤트 등록
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventPw, setEventPw] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  // CCU CSV 업로드
  const [csvPw, setCsvPw] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // 게임 삭제
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const otherGames = games.filter(
    (g) => String(g.appid) !== String(currentAppId) && g.status === "active"
  );

  async function handleAddEvent() {
    if (!eventTitle || !eventDate || !eventPw) return;
    setAddingEvent(true);
    const res = await fetch("/api/admin/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: currentAppId, title: eventTitle, date: eventDate, password: eventPw }),
    });
    const data = await res.json();
    setAddingEvent(false);
    if (data.ok) {
      show("이벤트가 등록되었습니다. 재분석이 시작됩니다.", "success");
      setEventTitle(""); setEventDate(""); setEventPw("");
      onEventAdded();
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  async function handleUploadCsv() {
    if (!csvFile || !csvPw) return;
    setUploadingCsv(true);
    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("appid", currentAppId);
    formData.append("password", csvPw);
    const res = await fetch("/api/admin/upload-ccu", { method: "POST", body: formData });
    const data = await res.json();
    setUploadingCsv(false);
    if (data.ok) {
      show(`${data.added}건 병합 완료`, "success");
      setCsvFile(null); setCsvPw(""); if (csvRef.current) csvRef.current.value = "";
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  async function handleDelete() {
    if (!deletePw) return;
    setDeleting(true);
    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: currentAppId, password: deletePw }),
    });
    const data = await res.json();
    setDeleting(false);
    if (data.ok) {
      show("게임이 삭제되었습니다.", "success");
      setTimeout(onDeleted, 1000);
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="space-y-6">
      {/* 경쟁작 CCU 비교 */}
      <section className="bg-bg-card border border-border-default rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">경쟁작 CCU 비교</h3>
        <p className="text-xs text-text-muted mb-3">등록된 다른 게임의 CCU를 이 차트에 오버레이합니다</p>
        {otherGames.length === 0 ? (
          <p className="text-xs text-text-muted">등록된 다른 게임이 없습니다.</p>
        ) : (
          <>
            <select
              value={selectedCompare}
              onChange={(e) => setSelectedCompare(e.target.value)}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue mb-2"
            >
              <option value="">게임 선택...</option>
              {otherGames.map((g) => (
                <option key={g.appid} value={String(g.appid)}>
                  {g.name_kr || g.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedCompare && onCompareSelect(selectedCompare)}
              disabled={!selectedCompare}
              className="w-full py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm hover:bg-accent-blue/30 disabled:opacity-40 transition-colors"
            >
              오버레이 추가
            </button>
          </>
        )}
      </section>

      {/* 데이터 보정 툴 */}
      <section className="bg-bg-card border border-border-default rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-1">SteamDB CCU CSV 업로드</h3>
        <p className="text-xs text-text-muted mb-3">현재 게임에만 적용됩니다</p>
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-text-secondary mb-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border-default file:bg-bg-secondary file:text-text-secondary"
        />
        <input
          type="password"
          value={csvPw}
          onChange={(e) => setCsvPw(e.target.value)}
          placeholder="관리자 비밀번호"
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-accent-blue"
        />
        <button
          onClick={handleUploadCsv}
          disabled={!csvFile || !csvPw || uploadingCsv}
          className="w-full py-2 bg-bg-secondary border border-border-default text-text-secondary rounded-lg text-sm hover:bg-bg-hover disabled:opacity-40 transition-colors"
        >
          {uploadingCsv ? "업로드 중..." : "병합 업로드"}
        </button>
      </section>

      {/* 수동 이벤트 등록 */}
      <section className="bg-bg-card border border-border-default rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-1">수동 이슈/이벤트 등록</h3>
        <p className="text-xs text-text-muted mb-3">현재 게임에만 적용됩니다</p>
        <input
          type="text"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          placeholder="이벤트 제목 (예: 서버 장애)"
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-accent-blue"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-accent-blue text-text-primary"
        />
        <input
          type="password"
          value={eventPw}
          onChange={(e) => setEventPw(e.target.value)}
          placeholder="관리자 비밀번호"
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-accent-blue"
        />
        <button
          onClick={handleAddEvent}
          disabled={!eventTitle || !eventDate || !eventPw || addingEvent}
          className="w-full py-2 bg-accent-yellow/20 border border-accent-yellow/40 text-accent-yellow rounded-lg text-sm hover:bg-accent-yellow/30 disabled:opacity-40 transition-colors"
        >
          {addingEvent ? "등록 중..." : "이벤트 등록 + 재분석"}
        </button>
      </section>

      {/* 게임 삭제 */}
      <section className="bg-bg-card border border-accent-red/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-accent-red/80 mb-3">게임 삭제</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 bg-accent-red/10 border border-accent-red/30 text-accent-red/70 rounded-lg text-sm hover:bg-accent-red/20 transition-colors"
          >
            이 게임 삭제 (소프트 삭제)
          </button>
        ) : (
          <>
            <p className="text-xs text-text-muted mb-2">데이터는 보존됩니다. 홈 화면에서만 숨겨집니다.</p>
            <input
              type="password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-accent-red"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={!deletePw || deleting}
                className="flex-1 py-2 bg-accent-red/20 border border-accent-red/40 text-accent-red rounded-lg text-sm disabled:opacity-40"
              >
                {deleting ? "삭제 중..." : "삭제 확인"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                취소
              </button>
            </div>
          </>
        )}
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
