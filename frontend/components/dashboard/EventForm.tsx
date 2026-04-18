"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";

interface EventFormProps {
  appid: string;
  onEventAdded: () => void;
}

export default function EventForm({ appid, onEventAdded }: EventFormProps) {
  const { t } = useUiText();
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);

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
      body: JSON.stringify({ appid, title: eventTitle, date: eventDate, url: eventUrl, content: eventContent, password }),
    });
    const data = await res.json();
    setAdding(false);

    if (data.ok) {
      show(t("EVENT_SUCCESS"), "success");
      setEventTitle("");
      setEventDate("");
      setEventUrl("");
      setEventContent("");
      setOpen(false);
      onEventAdded();
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary border border-dashed border-border-default hover:border-border-hover rounded-lg px-3 py-2 transition-colors"
      >
        <Lock className="w-3 h-3" />
        {t("EVENT_FORM_TOGGLE")}
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 bg-bg-secondary border border-border-default rounded-xl p-4 space-y-2">
          <input
            type="text"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder={t("EVENT_TITLE_PLACEHOLDER")}
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
            placeholder={t("EVENT_URL_PLACEHOLDER")}
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
          <textarea
            value={eventContent}
            onChange={(e) => setEventContent(e.target.value)}
            placeholder={t("EVENT_CONTENT_PLACEHOLDER")}
            rows={6}
            className="w-full bg-bg-card border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue resize-y"
          />
          <button
            onClick={() => { if (!eventTitle || !eventDate) return; setShowModal(true); }}
            disabled={!eventTitle || !eventDate || adding}
            className="w-full py-2 bg-accent-yellow/20 border border-accent-yellow/40 text-accent-yellow rounded-lg text-sm font-medium hover:bg-accent-yellow/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            {adding ? t("EVENT_SUBMIT_BTN_LOADING") : t("EVENT_SUBMIT_BTN")}
          </button>
        </div>
      )}

      <AdminPasswordModal
        isOpen={showModal}
        title={t("EVENT_AUTH_TITLE")}
        description={`"${eventTitle}" 이벤트를 등록하고 재분석을 시작합니다.`}
        loading={adding}
        onConfirm={handleAdd}
        onClose={() => setShowModal(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
