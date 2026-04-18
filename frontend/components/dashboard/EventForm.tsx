"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";

interface EventFormProps {
  appid: string;
  onEventAdded: () => void;
}

export default function EventForm({ appid, onEventAdded }: EventFormProps) {
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);

  // 폼 필드
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [eventContent, setEventContent] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleAdd(password: string) {
    if (!eventTitle || !eventDate) return;
    setAdding(true);
    setShowModal(false);

    const res = await fetch("/api/admin/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appid,
        title: eventTitle,
        date: eventDate,
        url: eventUrl,
        content: eventContent,
        password,
      }),
    });
    const data = await res.json();
    setAdding(false);

    if (data.ok) {
      show("이벤트가 등록되었습니다. 재분석이 시작됩니다.", "success");
      setEventTitle("");
      setEventDate("");
      setEventUrl("");
      setEventContent("");
      setOpen(false);
      onEventAdded();
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="mb-6">
      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary border border-dashed border-border-default hover:border-border-hover rounded-lg px-3 py-2 transition-colors"
      >
        <Lock className="w-3 h-3" />
        수동 이슈/이벤트 등록 (관리자)
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 bg-bg-secondary border border-border-default rounded-xl p-4 space-y-2">
          <input
            type="text"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="이벤트 제목 (예: 서버 장애, 대규모 업데이트)"
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue text-text-primary"
          />
          <input
            type="url"
            value={eventUrl}
            onChange={(e) => setEventUrl(e.target.value)}
            placeholder="이벤트 URL (선택, 패치노트/공지 링크)"
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
          <textarea
            value={eventContent}
            onChange={(e) => setEventContent(e.target.value)}
            placeholder={`패치노트 전문, 공지사항, 커뮤니티 포스트 내용을 직접 붙여넣으세요.\nAI가 이 텍스트를 바탕으로 타임라인 카드를 생성합니다.\n(URL만으로 크롤링이 어려울 때 활용)`}
            rows={6}
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue resize-y"
          />
          <button
            onClick={() => {
              if (!eventTitle || !eventDate) return;
              setShowModal(true);
            }}
            disabled={!eventTitle || !eventDate || adding}
            className="w-full py-2 bg-accent-yellow/20 border border-accent-yellow/40 text-accent-yellow rounded-lg text-sm font-medium hover:bg-accent-yellow/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            {adding ? "등록 중..." : "이벤트 등록 + 재분석"}
          </button>
        </div>
      )}

      <AdminPasswordModal
        isOpen={showModal}
        title="이벤트 등록 인증"
        description={`"${eventTitle}" 이벤트를 등록하고 재분석을 시작합니다.`}
        loading={adding}
        onConfirm={handleAdd}
        onClose={() => setShowModal(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
