"use client";
import { useState, useEffect } from "react";
import { Lock } from "lucide-react";

interface AdminPasswordModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  loading?: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export default function AdminPasswordModal({
  isOpen,
  title = "관리자 인증",
  description,
  loading = false,
  onConfirm,
  onClose,
}: AdminPasswordModalProps) {
  const [pw, setPw] = useState("");

  // 모달 열릴 때마다 비밀번호 초기화
  useEffect(() => {
    if (isOpen) setPw("");
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim()) return;
    onConfirm(pw);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* 모달 패널 */}
      <div className="relative bg-bg-card border border-border-default rounded-2xl shadow-2xl p-6 w-80">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-text-muted shrink-0" />
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>

        {description && (
          <p className="text-xs text-text-muted mb-4 leading-relaxed">{description}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="관리자 비밀번호"
            autoFocus
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!pw.trim() || loading}
              className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {loading ? "처리 중..." : "확인"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
