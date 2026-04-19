"use client";
import { useState, useRef } from "react";
import { Upload, ExternalLink } from "lucide-react";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";

interface CcuAdminPanelProps {
  currentAppId: string;
  gameName: string;
  onCsvUploaded: () => void;
}

export default function CcuAdminPanel({
  currentAppId, gameName, onCsvUploaded,
}: CcuAdminPanelProps) {
  const { toast, show, clear } = useToast();

  // CSV 업로드
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  function handleOpenFileModal() {
    setShowFileModal(true);
    // 파일 선택 다이얼로그 즉시 열기
    setTimeout(() => csvRef.current?.click(), 50);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
    if (!file) setShowFileModal(false);
  }

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
    setCsvFile(null);
    setShowFileModal(false);
    if (csvRef.current) csvRef.current.value = "";
    if (data.ok) {
      show(`${data.added}건 병합 완료`, "success");
      onCsvUploaded();
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border-default flex items-center justify-between gap-3">
      {/* SteamDB 링크 */}
      <a
        href={`https://steamdb.info/app/${currentAppId}/graphs/`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-text-muted hover:text-accent-blue flex items-center gap-1 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        {gameName} SteamDB
      </a>

      {/* CSV 업로드 버튼 */}
      <button
        onClick={handleOpenFileModal}
        disabled={uploadingCsv}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border-default text-text-muted rounded-lg text-xs hover:bg-bg-hover hover:text-text-secondary transition-colors disabled:opacity-40"
      >
        <Upload className="w-3 h-3" />
        {uploadingCsv ? "업로드 중..." : "SteamDB CSV 업로드"}
      </button>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={csvRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 파일 선택 후 확인 모달 */}
      {showFileModal && csvFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-2">SteamDB CCU CSV 업로드</h3>
            <p className="text-xs text-text-muted mb-1">선택된 파일:</p>
            <p className="text-xs text-text-secondary bg-bg-secondary rounded px-3 py-2 mb-4 truncate">
              {csvFile.name}
            </p>
            <p className="text-xs text-text-muted mb-4">현재 게임({gameName})에만 적용됩니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCsvModal(true)}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm hover:bg-accent-blue/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                업로드
              </button>
              <button
                onClick={() => { setShowFileModal(false); setCsvFile(null); if (csvRef.current) csvRef.current.value = ""; }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

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
