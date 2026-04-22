"use client";
import Link from "next/link";
import { useUiText } from "@/contexts/UiTextContext";

function TipBox({ children, label = "💡 Tip" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg px-4 py-3 text-xs text-accent-green leading-relaxed">
      <span className="font-semibold">{label}  </span>{children}
    </div>
  );
}

function AdminBox({ children, label = "🔐 관리자 기능" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-4 py-3 text-xs text-accent-yellow leading-relaxed">
      <span className="font-semibold">{label}  </span>{children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border-default">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 pr-4 text-text-muted font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-default/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-text-secondary align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UsagePage() {
  const { t } = useUiText();

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{t("USAGE_PAGE_TITLE")}</h1>
          <p className="text-text-secondary text-sm">{t("USAGE_PAGE_DESC")}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/" className="text-accent-blue hover:underline">{t("NAV_HOME")}</Link>
          <Link href="/guide" className="text-accent-blue hover:underline">{t("NAV_GUIDE_BACK")}</Link>
        </div>
      </div>

      {/* 본문 카드 */}
      <div className="bg-bg-card border border-border-default rounded-xl p-6 space-y-7">

        {/* 서비스 소개 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">{t("USAGE_H_SERVICE")}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("USAGE_SERVICE_DESC")}
          </p>
        </div>

        {/* 게임 등록 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_REGISTER")}</h3>
          <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
            <li>{t("USAGE_REGISTER_L1")}</li>
            <li>{t("USAGE_REGISTER_L2")}</li>
            <li>{t("USAGE_REGISTER_L3")}</li>
          </ol>
          <div className="mt-3 space-y-2">
            <TipBox label={t("LABEL_TIP")}>{t("USAGE_REGISTER_TIP1")}</TipBox>
            <TipBox label={t("LABEL_TIP")}>{t("USAGE_REGISTER_TIP2")}</TipBox>
          </div>
        </div>

        {/* 대시보드 각 탭 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_DASHBOARD")}</h3>

          <div className="space-y-5">

            <div className="pl-3 border-l-2 border-accent-blue/30">
              <p className="text-xs font-semibold text-text-primary mb-1">{t("USAGE_H_HEADER")}</p>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li>• {t("USAGE_HEADER_L1")}</li>
                <li>• {t("USAGE_HEADER_L2")}</li>
                <li>• {t("USAGE_HEADER_L3")}</li>
              </ul>
            </div>

            <div className="pl-3 border-l-2 border-accent-blue/30">
              <p className="text-xs font-semibold text-text-primary mb-1">{t("USAGE_H_CCU")}</p>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li>• {t("USAGE_CCU_L1")}</li>
                <li>• {t("USAGE_CCU_L2")}</li>
              </ul>
              <div className="mt-2">
                <AdminBox label={t("LABEL_ADMIN_FUNC")}>{t("USAGE_CCU_ADMIN")}</AdminBox>
              </div>
            </div>

            <div className="pl-3 border-l-2 border-accent-blue/30">
              <p className="text-xs font-semibold text-text-primary mb-1">{t("USAGE_H_SENTIMENT")}</p>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li>• {t("USAGE_SENTIMENT_L1")}</li>
                <li>• {t("USAGE_SENTIMENT_L2")}</li>
              </ul>
              <div className="mt-2">
                <TipBox label={t("LABEL_TIP")}>{t("USAGE_SENTIMENT_TIP")}</TipBox>
              </div>
            </div>

            <div className="pl-3 border-l-2 border-accent-blue/30">
              <p className="text-xs font-semibold text-text-primary mb-1">{t("USAGE_H_LANGUAGE")}</p>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li>• {t("USAGE_LANGUAGE_L1")}</li>
                <li>• {t("USAGE_LANGUAGE_L2")}</li>
                <li>• {t("USAGE_LANGUAGE_L3")}</li>
              </ul>
              <div className="mt-2">
                <TipBox label={t("LABEL_TIP")}>{t("USAGE_LANGUAGE_TIP")}</TipBox>
              </div>
            </div>

          </div>
        </div>

        {/* 타임라인 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_TIMELINE")}</h3>
          <ul className="text-sm text-text-secondary space-y-2">
            <li>• {t("USAGE_TIMELINE_L1")}</li>
            <li>• {t("USAGE_TIMELINE_L2")}</li>
            <li>• {t("USAGE_TIMELINE_L3")}</li>
            <li>• {t("USAGE_TIMELINE_L4")}</li>
          </ul>
          <div className="mt-3 space-y-2">
            <TipBox label={t("LABEL_TIP")}>{t("USAGE_TIMELINE_TIP")}</TipBox>
            <AdminBox label={t("LABEL_ADMIN_FUNC")}>{t("USAGE_TIMELINE_ADMIN")}</AdminBox>
          </div>
        </div>

        {/* 데이터 갱신 주기 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_SCHEDULE")}</h3>
          <Table
            headers={[t("TH_DATA_KIND"), t("TH_KST_TIME"), t("TH_NOTE")]}
            rows={[
              [t("USAGE_SCH_T1_1"), t("USAGE_SCH_T1_2"), t("USAGE_SCH_T1_3")],
              [t("USAGE_SCH_T2_1"), t("USAGE_SCH_T2_2"), t("USAGE_SCH_T2_3")],
              [t("USAGE_SCH_T3_1"), t("USAGE_SCH_T3_2"), t("USAGE_SCH_T3_3")],
              [t("USAGE_SCH_T4_1"), t("USAGE_SCH_T4_2"), t("USAGE_SCH_T4_3")],
              ["평가 급변 감지", "매주 월요일 11:00 KST", "전체 기간 월별 긍정률 변화를 분석해 급락·회복 구간을 탐지하고 AI 원인 분석을 수행합니다."],
            ]}
          />
          <div className="mt-3">
            <TipBox label={t("LABEL_TIP")}>{t("USAGE_SCH_TIP")}</TipBox>
          </div>
        </div>

        {/* 평가 급변 감지 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">평가 급변 감지</h3>
          <p className="text-sm text-text-secondary leading-relaxed mb-3">
            전체 기간의 월별 긍정률 시계열을 분석해 급격한 변화 구간을 자동으로 탐지하고,
            AI가 해당 시점의 패치 내역·이벤트 맥락을 바탕으로 원인을 분석합니다.
          </p>
          <div className="space-y-3">
            <div className="pl-3 border-l-2 border-accent-red/40">
              <p className="text-xs font-semibold text-text-primary mb-1">📉 급락 탐지</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                이전 구간 대비 긍정률이 급격히 하락한 시점을 감지합니다.
                대규모 패치 반발, 서버 불안정, 정책 변경 등이 주요 원인입니다.
              </p>
            </div>
            <div className="pl-3 border-l-2 border-accent-green/40">
              <p className="text-xs font-semibold text-text-primary mb-1">📈 회복 탐지</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                급락 이후 긍정률이 반등한 구간을 감지합니다.
                긴급 패치 배포, 무료 이벤트, 불만 해소 업데이트 등이 회복의 계기가 됩니다.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <TipBox label="💡 Tip">
              탐지 결과는 게임 타임라인에 별도 이벤트 행으로 기록됩니다. 해당 구간의 패치 이벤트와 함께 살펴보면 감성 변화 원인을 파악하는 데 도움이 됩니다.
            </TipBox>
          </div>
        </div>

        {/* 자동 재분석 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">자동 재분석</h3>
          <p className="text-sm text-text-secondary leading-relaxed mb-3">
            월간 AI 분석은 기본적으로 아직 분석되지 않은 기간만 처리합니다.
            그러나 서비스 초기처럼 리뷰 수집이 완료되기 전에 분석이 실행된 경우, 이후 데이터가 추가돼도 해당 월은 재분석되지 않을 수 있습니다.
            이를 해결하기 위해 <span className="font-medium text-text-primary">자동 재분석 메커니즘</span>이 적용되어 있습니다.
          </p>
          <div className="bg-bg-secondary rounded-lg px-4 py-3 text-xs text-text-secondary leading-relaxed space-y-1.5 mb-3">
            <p className="font-semibold text-text-primary mb-1">작동 방식</p>
            <p>• 월간 분석 실행 시, <span className="font-medium text-text-primary">직전 분석 시점의 수집 리뷰 수</span>를 현재 수집 수와 비교합니다.</p>
            <p>• 현재 수집 수가 직전 분석 수 대비 <span className="font-medium text-accent-green">10% 이상 증가</span>한 경우, 완료된 월도 포함하여 전체 기간을 다시 분석합니다.</p>
            <p>• 10% 미만 증가 시에는 새로운 월만 분석하며 기존 분석 결과는 유지됩니다.</p>
          </div>
          <div className="space-y-2">
            <TipBox label="💡 Tip">
              수집 리뷰가 충분히 쌓인 뒤 AI 분석을 승인하면 자동 재분석 없이도 정확한 결과를 얻을 수 있습니다.
              리뷰 수집 완료 전에 승인이 필요한 경우, 관리자 패널에서 &quot;⏳ 리뷰 수집 완료 후 분석하기&quot;를 선택하세요.
            </TipBox>
            <AdminBox label="🔐 관리자 기능">
              관리자 패널 게임 목록의 &quot;수집 리뷰&quot; 열에서 <span className="font-medium">↑ 자동 재분석 예정</span> 뱃지로 다음 분석 시 자동 재분석 여부를 미리 확인할 수 있습니다.
            </AdminBox>
          </div>
        </div>

        {/* 관리자 기능 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_ADMIN")}</h3>
          <p className="text-xs text-text-muted mb-3">{t("USAGE_ADMIN_DESC")}</p>
          <Table
            headers={[t("TH_FEATURE"), t("TH_LOCATION"), t("TH_FUNC_DESC")]}
            rows={[
              [t("USAGE_ADMIN_T1_1"), t("USAGE_ADMIN_T1_2"), t("USAGE_ADMIN_T1_3")],
              [t("USAGE_ADMIN_T2_1"), t("USAGE_ADMIN_T2_2"), t("USAGE_ADMIN_T2_3")],
              [t("USAGE_ADMIN_T3_1"), t("USAGE_ADMIN_T3_2"), t("USAGE_ADMIN_T3_3")],
              [t("USAGE_ADMIN_T4_1"), t("USAGE_ADMIN_T4_2"), t("USAGE_ADMIN_T4_3")],
              [t("USAGE_ADMIN_T5_1"), t("USAGE_ADMIN_T5_2"), t("USAGE_ADMIN_T5_3")],
              ["⚡ 평가 급변 감지", "관리자 패널 → 시스템 도구", "전체 게임의 긍정률 급변 구간을 즉시 탐지합니다. 매주 월요일 자동 실행되나 즉시 실행이 필요할 때 사용합니다."],
              ["AI 분석 승인 (수집 미완료 경고)", "관리자 패널 → 게임 목록 → AI 승인", "리뷰 수집이 95% 미만인 상태에서 AI 분석 승인 시 경고 모달이 표시됩니다. 즉시 분석 또는 수집 완료 후 분석을 선택할 수 있습니다."],
            ]}
          />
        </div>

      </div>
    </div>
  );
}
