"use client";
import { useState, useEffect } from "react";
import { useUiText } from "@/contexts/UiTextContext";

const STORAGE_KEY = "onboard_dismissed";

const STEPS = [
  {
    icon: "🔍",
    titleKey: "ONBOARD_STEP1_TITLE",
    descKey:  "ONBOARD_STEP1_DESC",
    noteKey:  null as string | null,
    border:   "border-accent-blue",
    iconBg:   "bg-accent-blue/10",
  },
  {
    icon: "🎮",
    titleKey: "ONBOARD_STEP2_TITLE",
    descKey:  "ONBOARD_STEP2_DESC",
    noteKey:  null as string | null,
    border:   "border-accent-purple",
    iconBg:   "bg-accent-purple/10",
  },
  {
    icon: "🤖",
    titleKey: "ONBOARD_STEP3_TITLE",
    descKey:  "ONBOARD_STEP3_DESC",
    noteKey:  "ONBOARD_STEP3_NOTE",
    border:   "border-accent-green",
    iconBg:   "bg-accent-green/10",
  },
  {
    icon: "📊",
    titleKey: "ONBOARD_STEP4_TITLE",
    descKey:  "ONBOARD_STEP4_DESC",
    noteKey:  null as string | null,
    border:   "border-accent-orange",
    iconBg:   "bg-accent-orange/10",
  },
];

export default function OnboardingModal() {
  const { t } = useUiText();
  // 플래시 방지: 초기값 true로 시작 → useEffect에서 localStorage 확인 후 갱신
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(STORAGE_KEY));
  }, []);

  const handleClose = () => setOpen(false);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
    setOpen(false);
  };

  return (
    <>
      {/* ── 좌하단 플로팅 트리거 버튼 ──────────────────────────────── */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-bg-card border border-border-default rounded-full
            pl-2.5 pr-3.5 py-1.5 shadow-lg
            hover:border-accent-blue hover:bg-accent-blue/5
            transition-all duration-200 group"
        >
          {/* 레드닷 — 처음 방문자에게만 표시 */}
          <span className="relative flex h-2 w-2 flex-shrink-0">
            {!dismissed && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dismissed ? "bg-border-hover" : "bg-accent-red"}`} />
          </span>
          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors whitespace-nowrap">
            {t("ONBOARD_TRIGGER_LABEL")}
          </span>
        </button>
      </div>

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
              w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <h2 className="text-base font-semibold text-text-primary">
                {t("ONBOARD_MODAL_TITLE")}
              </h2>
              <button
                onClick={handleClose}
                className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-secondary"
              >
                ✕
              </button>
            </div>

            {/* 스텝 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
              {STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className={`bg-bg-secondary rounded-xl border-l-[3px] border border-border-default p-4 flex flex-col gap-2.5 ${step.border}`}
                >
                  {/* 아이콘 + 제목 */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${step.iconBg}`}>
                      <span className="text-lg">{step.icon}</span>
                    </div>
                    <div>
                      <p className="text-[9px] text-text-muted font-mono tracking-widest uppercase">
                        STEP {idx + 1}
                      </p>
                      <p className="text-sm font-semibold text-text-primary leading-tight">
                        {t(step.titleKey)}
                      </p>
                    </div>
                  </div>

                  {/* 설명 */}
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {t(step.descKey)}
                  </p>

                  {/* 주의사항 노트 */}
                  {step.noteKey && (
                    <p className="text-[10px] text-text-muted border-t border-border-default pt-2 mt-auto">
                      * {t(step.noteKey)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-between px-5 pb-5 pt-1">
              <button
                onClick={handleDismiss}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {t("ONBOARD_BTN_DISMISS")}
              </button>
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
