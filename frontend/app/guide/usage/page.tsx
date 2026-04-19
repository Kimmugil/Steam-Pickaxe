"use client";
import Link from "next/link";
import { useUiText } from "@/contexts/UiTextContext";

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg px-4 py-3 text-xs text-accent-green leading-relaxed">
      <span className="font-semibold">💡 Tip  </span>{children}
    </div>
  );
}

function AdminBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-4 py-3 text-xs text-accent-yellow leading-relaxed">
      <span className="font-semibold">🔐 관리자 기능  </span>{children}
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
          <Link href="/" className="text-accent-blue hover:underline">← 홈으로</Link>
          <Link href="/guide" className="text-accent-blue hover:underline">← 분석 방법 가이드</Link>
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
            <TipBox>{t("USAGE_REGISTER_TIP1")}</TipBox>
            <TipBox>{t("USAGE_REGISTER_TIP2")}</TipBox>
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
                <AdminBox>{t("USAGE_CCU_ADMIN")}</AdminBox>
              </div>
            </div>

            <div className="pl-3 border-l-2 border-accent-blue/30">
              <p className="text-xs font-semibold text-text-primary mb-1">{t("USAGE_H_SENTIMENT")}</p>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li>• {t("USAGE_SENTIMENT_L1")}</li>
                <li>• {t("USAGE_SENTIMENT_L2")}</li>
              </ul>
              <div className="mt-2">
                <TipBox>{t("USAGE_SENTIMENT_TIP")}</TipBox>
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
                <TipBox>{t("USAGE_LANGUAGE_TIP")}</TipBox>
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
            <TipBox>{t("USAGE_TIMELINE_TIP")}</TipBox>
            <AdminBox>{t("USAGE_TIMELINE_ADMIN")}</AdminBox>
          </div>
        </div>

        {/* 데이터 갱신 주기 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_SCHEDULE")}</h3>
          <Table
            headers={["데이터 종류", "갱신 시간 (KST)", "비고"]}
            rows={[
              [t("USAGE_SCH_T1_1"), t("USAGE_SCH_T1_2"), t("USAGE_SCH_T1_3")],
              [t("USAGE_SCH_T2_1"), t("USAGE_SCH_T2_2"), t("USAGE_SCH_T2_3")],
              [t("USAGE_SCH_T3_1"), t("USAGE_SCH_T3_2"), t("USAGE_SCH_T3_3")],
              [t("USAGE_SCH_T4_1"), t("USAGE_SCH_T4_2"), t("USAGE_SCH_T4_3")],
            ]}
          />
          <div className="mt-3">
            <TipBox>{t("USAGE_SCH_TIP")}</TipBox>
          </div>
        </div>

        {/* 관리자 기능 */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">{t("USAGE_H_ADMIN")}</h3>
          <p className="text-xs text-text-muted mb-3">{t("USAGE_ADMIN_DESC")}</p>
          <Table
            headers={["기능", "위치", "설명"]}
            rows={[
              [t("USAGE_ADMIN_T1_1"), t("USAGE_ADMIN_T1_2"), t("USAGE_ADMIN_T1_3")],
              [t("USAGE_ADMIN_T2_1"), t("USAGE_ADMIN_T2_2"), t("USAGE_ADMIN_T2_3")],
              [t("USAGE_ADMIN_T3_1"), t("USAGE_ADMIN_T3_2"), t("USAGE_ADMIN_T3_3")],
              [t("USAGE_ADMIN_T4_1"), t("USAGE_ADMIN_T4_2"), t("USAGE_ADMIN_T4_3")],
              [t("USAGE_ADMIN_T5_1"), t("USAGE_ADMIN_T5_2"), t("USAGE_ADMIN_T5_3")],
            ]}
          />
        </div>

      </div>
    </div>
  );
}
