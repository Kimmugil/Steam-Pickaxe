"use client";
import { useState } from "react";
import Link from "next/link";
import { useUiText } from "@/contexts/UiTextContext";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

function InfoBox({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "yellow" | "red" | "green" }) {
  const cls = {
    blue:   "bg-accent-blue/5 border-accent-blue/20 text-accent-blue",
    yellow: "bg-accent-yellow/5 border-accent-yellow/20 text-accent-yellow",
    red:    "bg-accent-red/5 border-accent-red/20 text-accent-red",
    green:  "bg-accent-green/5 border-accent-green/20 text-accent-green",
  }[color];
  return (
    <div className={`border rounded-lg px-4 py-3 text-xs leading-relaxed ${cls}`}>
      {children}
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

function Mono({ children }: { children: string }) {
  return <code className="font-mono bg-bg-secondary px-1.5 py-0.5 rounded text-accent-blue text-[11px]">{children}</code>;
}

export default function GuidePage() {
  const { t } = useUiText();
  const [activeSection, setActiveSection] = useState<string>("overview");

  // ── 기술 가이드 섹션들 ──────────────────────────────────────────────
  const sections: Section[] = [
    {
      id: "overview",
      title: t("GUIDE_SEC_OVERVIEW"),
      content: (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            {t("GUIDE_OV_DESC")}
          </p>
          <Table
            headers={["구성 요소", "역할", "기술"]}
            rows={[
              [t("GUIDE_OV_T1_1"), t("GUIDE_OV_T1_2"), t("GUIDE_OV_T1_3")],
              [t("GUIDE_OV_T2_1"), t("GUIDE_OV_T2_2"), t("GUIDE_OV_T2_3")],
              [t("GUIDE_OV_T3_1"), t("GUIDE_OV_T3_2"), t("GUIDE_OV_T3_3")],
              [t("GUIDE_OV_T4_1"), t("GUIDE_OV_T4_2"), t("GUIDE_OV_T4_3")],
            ]}
          />
          <InfoBox color="blue">
            {t("GUIDE_OV_INFO")}
          </InfoBox>
        </div>
      ),
    },
    {
      id: "schedule",
      title: t("GUIDE_SEC_SCHEDULE"),
      content: (
        <div className="space-y-4">
          <Table
            headers={["워크플로우", "실행 주기", "KST 기준", "주요 작업"]}
            rows={[
              [t("GUIDE_SCH_T1_1"), t("GUIDE_SCH_T1_2"), t("GUIDE_SCH_T1_3"), t("GUIDE_SCH_T1_4")],
              [t("GUIDE_SCH_T2_1"), t("GUIDE_SCH_T2_2"), t("GUIDE_SCH_T2_3"), t("GUIDE_SCH_T2_4")],
              [t("GUIDE_SCH_T3_1"), t("GUIDE_SCH_T3_2"), t("GUIDE_SCH_T3_3"), t("GUIDE_SCH_T3_4")],
            ]}
          />
          <InfoBox color="green">
            {t("GUIDE_SCH_INFO1")}
          </InfoBox>
          <InfoBox color="yellow">
            {t("GUIDE_SCH_INFO2")}
          </InfoBox>
        </div>
      ),
    },
    {
      id: "reviews",
      title: t("GUIDE_SEC_REVIEWS"),
      content: (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{t("GUIDE_REV_H_API")}</h3>
          <Table
            headers={["파라미터", "값", "이유"]}
            rows={[
              [<Mono key="n">{t("GUIDE_REV_API_T1_1")}</Mono>, t("GUIDE_REV_API_T1_2"), t("GUIDE_REV_API_T1_3")],
              [<Mono key="f">{t("GUIDE_REV_API_T2_1")}</Mono>, t("GUIDE_REV_API_T2_2"), t("GUIDE_REV_API_T2_3")],
              [<Mono key="p">{t("GUIDE_REV_API_T3_1")}</Mono>, t("GUIDE_REV_API_T3_2"), t("GUIDE_REV_API_T3_3")],
              [<Mono key="l">{t("GUIDE_REV_API_T4_1")}</Mono>, t("GUIDE_REV_API_T4_2"), t("GUIDE_REV_API_T4_3")],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_REV_H_CURSOR")}</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• {t("GUIDE_REV_CURSOR_L1")}</li>
            <li>• {t("GUIDE_REV_CURSOR_L2")}</li>
            <li>• {t("GUIDE_REV_CURSOR_L3")}</li>
          </ul>
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_REV_H_DEDUP")}</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• {t("GUIDE_REV_DEDUP_L1")}</li>
            <li>• {t("GUIDE_REV_DEDUP_L2")}</li>
            <li>• {t("GUIDE_REV_DEDUP_L3")}</li>
            <li>• {t("GUIDE_REV_DEDUP_L4")}</li>
          </ul>
          <InfoBox color="yellow">
            {t("GUIDE_REV_INFO")}
          </InfoBox>
        </div>
      ),
    },
    {
      id: "news",
      title: t("GUIDE_SEC_NEWS"),
      content: (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{t("GUIDE_NEWS_H_SOURCE")}</h3>
          <Table
            headers={["소스", "API", "수집 내용"]}
            rows={[
              [t("GUIDE_NEWS_SRC_T1_1"), t("GUIDE_NEWS_SRC_T1_2"), t("GUIDE_NEWS_SRC_T1_3")],
              [t("GUIDE_NEWS_SRC_T2_1"), t("GUIDE_NEWS_SRC_T2_2"), t("GUIDE_NEWS_SRC_T2_3")],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_NEWS_H_CLASS")}</h3>
          <Table
            headers={["분류", "기준", "표시"]}
            rows={[
              [t("GUIDE_NEWS_CLS_T1_1"), t("GUIDE_NEWS_CLS_T1_2"), t("GUIDE_NEWS_CLS_T1_3")],
              [t("GUIDE_NEWS_CLS_T2_1"), t("GUIDE_NEWS_CLS_T2_2"), t("GUIDE_NEWS_CLS_T2_3")],
              [t("GUIDE_NEWS_CLS_T3_1"), t("GUIDE_NEWS_CLS_T3_2"), t("GUIDE_NEWS_CLS_T3_3")],
              [t("GUIDE_NEWS_CLS_T4_1"), t("GUIDE_NEWS_CLS_T4_2"), t("GUIDE_NEWS_CLS_T4_3")],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_NEWS_H_CONTENT")}</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• {t("GUIDE_NEWS_CONTENT_L1")}</li>
            <li>• {t("GUIDE_NEWS_CONTENT_L2")}</li>
            <li>• {t("GUIDE_NEWS_CONTENT_L3")}</li>
          </ul>
          <InfoBox color="blue">
            {t("GUIDE_NEWS_INFO")}
          </InfoBox>
        </div>
      ),
    },
    {
      id: "bucketing",
      title: t("GUIDE_SEC_BUCKETING"),
      content: (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            {t("GUIDE_BKT_DESC")}
          </p>
          <Table
            headers={["조건", "처리"]}
            rows={[
              [t("GUIDE_BKT_T1_1"), t("GUIDE_BKT_T1_2")],
              [t("GUIDE_BKT_T2_1"), t("GUIDE_BKT_T2_2")],
              [t("GUIDE_BKT_T3_1"), t("GUIDE_BKT_T3_2")],
              [t("GUIDE_BKT_T4_1"), t("GUIDE_BKT_T4_2")],
              [t("GUIDE_BKT_T5_1"), t("GUIDE_BKT_T5_2")],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_BKT_H_REANALYZE")}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("GUIDE_BKT_REANALYZE_DESC")}
          </p>
          <h3 className="text-sm font-semibold text-text-primary mt-4">{t("GUIDE_BKT_H_SPARSE")}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("GUIDE_BKT_SPARSE_DESC")}
          </p>
        </div>
      ),
    },
    {
      id: "ai-analysis",
      title: t("GUIDE_SEC_AI"),
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H_MODEL")}</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• {t("GUIDE_AI_MODEL_L1")}</li>
              <li>• {t("GUIDE_AI_MODEL_L2")}</li>
              <li>• {t("GUIDE_AI_MODEL_L3")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H1")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S1_DESC")}
            </p>
            <ul className="text-sm text-text-secondary space-y-1 mt-2">
              <li>• {t("GUIDE_AI_S1_L1")}</li>
              <li>• {t("GUIDE_AI_S1_L2")}</li>
              <li>• {t("GUIDE_AI_S1_L3")}</li>
              <li>• {t("GUIDE_AI_S1_L4")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H2")}</h3>
            <Table
              headers={["출력 필드", "내용"]}
              rows={[
                [t("GUIDE_AI_S2_T1_1"), t("GUIDE_AI_S2_T1_2")],
                [t("GUIDE_AI_S2_T2_1"), t("GUIDE_AI_S2_T2_2")],
                [t("GUIDE_AI_S2_T3_1"), t("GUIDE_AI_S2_T3_2")],
                [t("GUIDE_AI_S2_T4_1"), t("GUIDE_AI_S2_T4_2")],
              ]}
            />
            <p className="text-xs text-text-muted mt-2">
              {t("GUIDE_AI_S2_NOTE")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H3")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S3_DESC")}
            </p>
            <Table
              headers={["판별 유형", "요약 방식"]}
              rows={[
                [t("GUIDE_AI_S3_T1_1"), t("GUIDE_AI_S3_T1_2")],
                [t("GUIDE_AI_S3_T2_1"), t("GUIDE_AI_S3_T2_2")],
                [t("GUIDE_AI_S3_T3_1"), t("GUIDE_AI_S3_T3_2")],
                [t("GUIDE_AI_S3_T4_1"), t("GUIDE_AI_S3_T4_2")],
                [t("GUIDE_AI_S3_T5_1"), t("GUIDE_AI_S3_T5_2")],
              ]}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H4")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S4_DESC")}
            </p>
            <ul className="text-sm text-text-secondary space-y-1 mt-2">
              <li>• {t("GUIDE_AI_S4_L1")}</li>
              <li>• {t("GUIDE_AI_S4_L2")}</li>
              <li>• {t("GUIDE_AI_S4_L3")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H5")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S5_DESC")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H6")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S6_DESC")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_AI_H7")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_AI_S7_DESC")}
            </p>
          </div>

          <InfoBox color="yellow">
            {t("GUIDE_AI_INFO")}
          </InfoBox>
        </div>
      ),
    },
    {
      id: "metrics",
      title: t("GUIDE_SEC_METRICS"),
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_MTR_H_SENTIMENT")}</h3>
            <Table
              headers={["범위", "해석", "배지 색상"]}
              rows={[
                [t("GUIDE_MTR_SR_T1_1"), t("GUIDE_MTR_SR_T1_2"), t("GUIDE_MTR_SR_T1_3")],
                [t("GUIDE_MTR_SR_T2_1"), t("GUIDE_MTR_SR_T2_2"), t("GUIDE_MTR_SR_T2_3")],
                [t("GUIDE_MTR_SR_T3_1"), t("GUIDE_MTR_SR_T3_2"), t("GUIDE_MTR_SR_T3_3")],
                [t("GUIDE_MTR_SR_T4_1"), t("GUIDE_MTR_SR_T4_2"), t("GUIDE_MTR_SR_T4_3")],
              ]}
            />
            <InfoBox color="yellow">
              {t("GUIDE_MTR_SR_INFO")}
            </InfoBox>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_MTR_H_CCU")}</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• {t("GUIDE_MTR_CCU_L1")}</li>
              <li>• {t("GUIDE_MTR_CCU_L2")}</li>
              <li>• {t("GUIDE_MTR_CCU_L3")}</li>
              <li>• {t("GUIDE_MTR_CCU_L4")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_MTR_H_LANG")}</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• {t("GUIDE_MTR_LANG_L1")}</li>
              <li>• {t("GUIDE_MTR_LANG_L2")}</li>
              <li>• {t("GUIDE_MTR_LANG_L3")}</li>
              <li>• {t("GUIDE_MTR_LANG_L4")}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_MTR_H_TIMELINE")}</h3>
            <Table
              headers={["상태", "의미"]}
              rows={[
                [t("GUIDE_MTR_TL_T1_1"), t("GUIDE_MTR_TL_T1_2")],
                [t("GUIDE_MTR_TL_T2_1"), t("GUIDE_MTR_TL_T2_2")],
                [t("GUIDE_MTR_TL_T3_1"), t("GUIDE_MTR_TL_T3_2")],
                [t("GUIDE_MTR_TL_T4_1"), t("GUIDE_MTR_TL_T4_2")],
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: "data-quality",
      title: t("GUIDE_SEC_LIMITS"),
      content: (
        <div className="space-y-4">
          <InfoBox color="red">
            {t("GUIDE_LIM_INFO1")}
          </InfoBox>
          <InfoBox color="yellow">
            {t("GUIDE_LIM_INFO2")}
          </InfoBox>
          <InfoBox color="yellow">
            {t("GUIDE_LIM_INFO3")}
          </InfoBox>
          <InfoBox color="yellow">
            {t("GUIDE_LIM_INFO4")}
          </InfoBox>
          <InfoBox color="blue">
            {t("GUIDE_LIM_INFO5")}
          </InfoBox>
          <InfoBox color="blue">
            {t("GUIDE_LIM_INFO6")}
          </InfoBox>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{t("GUIDE_LIM_H_ENGLISH")}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("GUIDE_LIM_ENGLISH_DESC")}
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{t("GUIDE_PAGE_TITLE")}</h1>
          <p className="text-text-secondary text-sm">
            {t("GUIDE_PAGE_DESC")}
          </p>
        </div>
        <Link href="/" className="text-xs text-accent-blue hover:underline">← 홈으로</Link>
      </div>

      <div className="flex gap-6">
        {/* 사이드바 네비게이션 */}
        <div className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-6 space-y-1">
            <div className="pt-2 pb-1">
              <p className="text-[10px] text-text-muted px-1 pb-2">{t("GUIDE_NAV_SECTION_LABEL")}</p>
            </div>

            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  activeSection === s.id
                    ? "bg-accent-blue/10 text-accent-blue font-medium"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          {/* 모바일 탭 */}
          <div className="lg:hidden flex gap-1 flex-wrap mb-6">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeSection === s.id
                    ? "bg-accent-blue text-white"
                    : "bg-bg-card border border-border-default text-text-muted hover:text-text-secondary"
                }`}
              >
                {s.title.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* 기술 가이드 섹션들 */}
          {sections.map((s) => (
            <div
              key={s.id}
              className={activeSection === s.id ? "block" : "hidden"}
            >
              <div className="bg-bg-card border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-bold text-text-primary mb-5">{s.title}</h2>
                {s.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
