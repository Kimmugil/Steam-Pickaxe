"use client";
import { useState, useEffect } from "react";
import { useUiText } from "@/contexts/UiTextContext";

const STORAGE_KEY = "onboard_seen";

export default function OnboardingModal() {
  const { t } = useUiText();
  const [seen, setSeen] = useState(true); // 플래시 방지용 초기값
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSeen(!!localStorage.getItem(STORAGE_KEY));
  }, []);

  const handleOpen = () => {
    setOpen(true);
    // 처음 클릭 시 레드닷 영구 제거
    if (!seen) {
      localStorage.setItem(STORAGE_KEY, "1");
      setSeen(true);
    }
  };

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* ── 인라인 트리거 버튼 ──────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary
          border border-border-default hover:border-border-hover
          rounded-full px-2.5 py-1 transition-all duration-200 whitespace-nowrap"
      >
        {t("ONBOARD_TRIGGER_LABEL")}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {!seen && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 transition-colors ${
            seen ? "bg-border-hover" : "bg-accent-red"
          }`} />
        </span>
      </button>

      {/* ── 모달 ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* 딤드 배경 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* 모달 본체 */}
          <div
            className="relative bg-bg-card border border-border-default rounded-2xl shadow-2xl
              w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <h2 className="text-base font-semibold text-text-primary">
                {t("ONBOARD_MODAL_TITLE")}
              </h2>
              <button
                onClick={handleClose}
                className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none
                  w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-secondary"
              >
                ✕
              </button>
            </div>

            {/* 카드 목록 */}
            <div className="flex flex-col gap-3 p-5">

              {/* ── 카드 1: 이 서비스는? ── */}
              <div className="bg-bg-secondary border border-border-default rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-xl">🔍</span>
                  <p className="text-sm font-semibold text-text-primary">
                    {t("ONBOARD_STEP1_TITLE")}
                  </p>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t("ONBOARD_STEP1_DESC")}
                </p>
              </div>

              {/* ── 카드 2: 사용 방법 (3스텝) ── */}
              <div className="bg-bg-secondary border border-border-default rounded-xl p-4">
                <p className="text-sm font-semibold text-text-primary mb-3">
                  {t("ONBOARD_HOW_TITLE")}
                </p>
                <div className="flex flex-col gap-3">

                  {/* STEP 1 */}
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0">🎮</span>
                    <div>
                      <p className="text-xs font-semibold text-text-primary leading-tight">
                        {t("ONBOARD_STEP2_TITLE")}
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                        {t("ONBOARD_STEP2_DESC")}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border-default/60" />

                  {/* STEP 2 */}
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0">🤖</span>
                    <div>
                      <p className="text-xs font-semibold text-text-primary leading-tight">
                        {t("ONBOARD_STEP3_TITLE")}
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                        {t("ONBOARD_STEP3_DESC")}
                      </p>
                      <p className="text-[10px] text-text-muted mt-1">
                        * {t("ONBOARD_STEP3_NOTE")}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border-default/60" />

                  {/* STEP 3 */}
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0">📊</span>
                    <div>
                      <p className="text-xs font-semibold text-text-primary leading-tight">
                        {t("ONBOARD_STEP4_TITLE")}
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                        {t("ONBOARD_STEP4_DESC")}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex justify-end px-5 pb-5 pt-1">
              <button
                onClick={handleClose}
                className="text-xs bg-accent-blue text-white px-4 py-2 rounded-lg
                  hover:bg-accent-blue/80 transition-colors font-medium"
              >
                {t("ONBOARD_BTN_CLOSE")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
