"use client";
import { useState } from "react";

interface AccordionItem {
  title: string;
  content: React.ReactNode;
}

function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-bg-hover transition-colors"
          >
            <span className="font-medium text-text-primary">{item.title}</span>
            <span className="text-text-muted text-sm">{open === i ? "▲" : "▼"}</span>
          </button>
          {open === i && (
            <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-border-default pt-4 space-y-2">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GuidePage() {
  const items: AccordionItem[] = [
    {
      title: "데이터 원천 수집 기준 및 Steam API 파라미터",
      content: (
        <ul className="space-y-2 list-none">
          <li><span className="text-accent-blue font-mono text-xs">Endpoint:</span> store.steampowered.com/appreviews/{"{"appid{"}"}</li>
          <li><span className="text-accent-blue font-mono text-xs">파라미터:</span> filter=recent · purchase_type=all · language=all · num_per_page=<strong>80</strong></li>
          <li>⚠️ num_per_page=100 설정 시 일부 게임에서 리뷰 드롭 버그 발생 — 반드시 80으로 고정</li>
          <li>커서 기반 페이지네이션. 이전 커서=현재 커서 감지 시 수집 완료로 판단.</li>
          <li>GitHub Actions 단일 Job 최대 6시간 제한. 초과 시 커서 저장 후 다음 스케줄에서 재개.</li>
        </ul>
      ),
    },
    {
      title: "시계열 버킷팅 규칙 및 구간 분할 원칙",
      content: (
        <ul className="space-y-2">
          <li>이벤트 N에 매핑되는 리뷰 범위: <strong>[이벤트 N 발생일 00:00:00 ~ 다음 이벤트 전날 23:59:59]</strong></li>
          <li>최신 이벤트의 범위: 현재 수집 시점까지</li>
          <li>이벤트가 0개인 게임: 전체 리뷰를 단일 버킷 '런칭~현재'로 처리</li>
          <li>동일 날짜 이벤트 2개 이상: 시간(HH:MM) 순서 구분. 시간 정보 없으면 하나로 병합.</li>
          <li>수동 이벤트 등록 시: 해당 날짜 기준 기존 구간 2개로 분할 → 재집계 → Gemini 재분석</li>
        </ul>
      ),
    },
    {
      title: "AI 분석 모델 및 샘플링 전략",
      content: (
        <ul className="space-y-2">
          <li>사용 모델: <strong>Google Gemini 2.5 Flash</strong> (롱컨텍스트 지원)</li>
          <li>구간당 최대 리뷰 <strong>2,000건</strong> 캡 적용 (컨텍스트 윈도우 한도 대응)</li>
          <li>샘플 선정: votes_up+votes_funny 상위 1,000건 + 최신순 1,000건 혼합</li>
          <li>언어별 비율에 따른 Stratified Sampling 적용 (영어 과대표집 방지)</li>
          <li>구간당 예상 비용: 약 $0.035/구간 (Gemini 2.5 Flash 기준)</li>
          <li>AI 원칙: 현상 진단 및 인과관계 객관적 분석만. 지시적/주관적 어조 배제.</li>
        </ul>
      ),
    },
    {
      title: "SteamSpy 추정치 한계 안내",
      content: (
        <ul className="space-y-2">
          <li>소유자 추정, 잔존율, 리뷰 전환율은 <strong>통계적 추정치</strong>이며 실제값과 차이가 있을 수 있습니다.</li>
          <li>출시 직후 및 무료 주말 직후에는 데이터 왜곡 가능성이 있습니다.</li>
          <li>리뷰 전환율 = 총 리뷰 수 ÷ 추정 소유자 수</li>
          <li>잔존율 = 최근 2주 활성 플레이어 ÷ 추정 소유자</li>
          <li>잔존율은 절대값이 아닌 경쟁작과의 상대 비교 지표로 활용하세요.</li>
        </ul>
      ),
    },
    {
      title: "리뷰 수집 동작 안내",
      content: (
        <ul className="space-y-2">
          <li>recommendationid가 동일하면 중복 적재하지 않습니다.</li>
          <li>유저가 리뷰를 <strong>수정</strong>해도 recommendationid는 변경되지 않으므로 수정 내용은 RAW에 반영되지 않고 <strong>최초 수집 버전이 보존</strong>됩니다.</li>
          <li><strong>삭제된 리뷰</strong>는 수집된 이후 RAW에 계속 잔존합니다.</li>
          <li>총 리뷰 수 표시는 Steam API 제공 total_reviews 값 기준입니다 (삭제 리뷰 제외됨).</li>
        </ul>
      ),
    },
    {
      title: "CCU 데이터 한계 안내",
      content: (
        <ul className="space-y-2">
          <li>CCU는 <strong>1시간 주기</strong>로 수집된 Steam API 실시간 호출값입니다.</li>
          <li>archived(삭제) 상태로 전환된 기간은 CCU 소급 수집이 불가하여 <strong>차트에서 공백 구간</strong>으로 표시됩니다.</li>
          <li>SteamDB에서 다운로드한 과거 CCU CSV를 업로드하면 공백 기간을 보정할 수 있습니다 (관리자 기능).</li>
        </ul>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">분석 방법 가이드</h1>
        <p className="text-text-secondary">
          스팀 탈곡기 Pro의 데이터 수집 기준, AI 분석 방식, 지표 해석 주의사항을 투명하게 안내합니다.
        </p>
      </div>
      <Accordion items={items} />
    </div>
  );
}
