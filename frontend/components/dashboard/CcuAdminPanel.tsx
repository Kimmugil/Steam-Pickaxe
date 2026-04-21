"use client";
import { useState, useRef } from "react";
import { Upload, ExternalLink } from "lucide-react";
import AdminPasswordModal from "@/components/shared/AdminPasswordModal";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";

interface CcuAdminPanelProps {
  currentAppId: string;
  gameName: string;
  onCsvUploaded: () => void;
}

export default function CcuAdminPanel({
  currentAppId, gameName, onCsvUploaded,
}: CcuAdminPanelProps) {
  const { toast, show, clear } = useToast();
  const { t } = useUiText();

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
      show(t("CSV_SUCCESS", { count: data.added }), "success");
      onCsvUploaded();
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
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
        {uploadingCsv ? t("CSV_UPLOADING") : t("CSV_UPLOAD_BTN")}
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
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("CSV_MODAL_TITLE")}</h3>
            <p className="text-xs text-text-muted mb-1">{t("CSV_SELECTED_FILE")}</p>
            <p className="text-xs text-text-secondary bg-bg-secondary rounded px-3 py-2 mb-4 truncate">
              {csvFile.name}
            </p>
            <p className="text-xs text-text-muted mb-4">{t("CSV_GAME_ONLY", { name: gameName })}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCsvModal(true)}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm hover:bg-accent-blue/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {t("CSV_UPLOAD_CONFIRM")}
              </button>
              <button
                onClick={() => { setShowFileModal(false); setCsvFile(null); if (csvRef.current) csvRef.current.value = ""; }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors"
              >
                {t("CSV_CANCEL")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 모달 */}
      <AdminPasswordModal
        isOpen={showCsvModal}
        title={t("CSV_AUTH_TITLE")}
        description={t("CSV_AUTH_DESC")}
        loading={uploadingCsv}
        onConfirm={handleUploadCsv}
        onClose={() => setShowCsvModal(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
