"use client";
import { useState, useRef } from "react";
import { Lock } from "lucide-react";
import type { Game } from "@/types";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";

interface CcuAdminPanelProps {
  currentAppId: string;
  games: Game[];
  onCompareSelect: (appid: string) => void;
  onCsvUploaded: () => void;
}

export default function CcuAdminPanel({
  currentAppId, games, onCompareSelect, onCsvUploaded,
}: CcuAdminPanelProps) {
  const { toast, show, clear } = useToast();
  const [selectedCompare, setSelectedCompare] = useState("");

  // CSV 업로드
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  const otherGames = games.filter(
    (g) => String(g.appid) !== String(currentAppId) && g.status === "active"
  );

  async function handleUploadCsv(password: string) {
    if (!csvFile) return;
    setUploadingCsv(true);
    setShowCsvModal(false);
    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("appid", currentAppId);
    formData.append("password", password);
    const res = await fetch("/api/admin/upload-ccu", { method: "POST", body: formData });
    const data = await res.json();
    setUploadingCsv(false);
    if (data.ok) {
      show(`${data.added}건 병합 완료`, "success");
      setCsvFile(null);
      if (csvRef.current) csvRef.current.value = "";
      onCsvUploaded();
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-border-default grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* 경쟁작 CCU 비교 */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-default">
        <h4 className="text-xs font-semibold text-text-primary mb-1">경쟁작 CCU 비교</h4>
        <p className="text-xs text-text-muted mb-3">등록된 다른 게임의 CCU를 이 차트에 오버레이합니다</p>
        {otherGames.length === 0 ? (
          <p className="text-xs text-text-muted">등록된 다른 게임이 없습니다.</p>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedCompare}
              onChange={(e) => setSelectedCompare(e.target.value)}
              className="flex-1 bg-bg-card border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
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
              className="px-3 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-xs hover:bg-accent-blue/30 disabled:opacity-40 transition-colors"
            >
              오버레이
            </button>
          </div>
        )}
      </div>

      {/* SteamDB CCU CSV 업로드 */}
      <div className="bg-bg-secondary rounded-xl p-4 border border-border-default">
        <h4 className="text-xs font-semibold text-text-primary mb-1">SteamDB CCU CSV 업로드</h4>
        <p className="text-xs text-text-muted mb-3">현재 게임에만 적용됩니다</p>
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-text-secondary mb-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border-default file:bg-bg-card file:text-text-secondary"
        />
        <button
          onClick={() => csvFile && setShowCsvModal(true)}
          disabled={!csvFile || uploadingCsv}
          className="w-full py-2 bg-bg-card border border-border-default text-text-secondary rounded-lg text-xs hover:bg-bg-hover disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
        >
          <Lock className="w-3 h-3" />
          {uploadingCsv ? "업로드 중..." : "병합 업로드"}
        </button>
      </div>

      {/* 비밀번호 모달 */}
      <AdminPasswordModal
        isOpen={showCsvModal}
        title="CSV 업로드 인증"
        description="SteamDB CCU CSV 업로드는 관리자만 가능합니다."
        loading={uploadingCsv}
        onConfirm={handleUploadCsv}
        onClose={() => setShowCsvModal(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
