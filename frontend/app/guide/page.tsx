"use client";
import { useState } from "react";
import Link from "next/link";

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

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState<string>("user-guide");

  // ── 이용 안내 (사용자 가이드) ────────────────────────────────────────
  const userGuideContent = (
    <div className="space-y-7">

      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">🎯 이 서비스는 무엇인가요?</h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          Steam 게임의 업데이트 유저 반응, 동접자(CCU), 언어권 분포를 이벤트 타임라인에 맞춰 분석해주는 대시보드입니다.
          개발사·퍼블리셔 관계자나 게임 시장 분석에 관심 있는 분들을 위해 설계됐습니다.
          수집부터 AI 분석까지 대부분 자동으로 이루어지며, 하루에 한 번 업데이트됩니다.
        </p>
      </div>

      {/* 게임 등록 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">📋 분석할 게임 등록하기</h3>
        <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
          <li>홈 화면 검색창에 <strong>게임명, AppID, 또는 스팀 상점 URL</strong>을 입력합니다.</li>
          <li>검색 결과에서 <strong>[이 게임 분석 등록하기]</strong> 버튼을 클릭합니다.</li>
          <li>수집 대기열에 올라가며, 리뷰 수에 따라 <strong>보통 1~3일 후 분석이 완료</strong>됩니다.</li>
        </ol>
        <div className="mt-3 space-y-2">
          <TipBox>
            한글 게임명 검색은 결과가 부정확할 수 있습니다. 영문명이나 AppID 검색을 권장합니다.
          </TipBox>
          <TipBox>
            리뷰 수가 매우 많은 게임(10만 건 이상)은 수집에 더 오래 걸릴 수 있습니다.
            대기열 화면에서 수집 진행 상황을 확인할 수 있습니다.
          </TipBox>
        </div>
      </div>

      {/* 대시보드 각 탭 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">📊 대시보드 각 탭 보는 법</h3>

        <div className="space-y-5">

          <div className="pl-3 border-l-2 border-accent-blue/30">
            <p className="text-xs font-semibold text-text-primary mb-1">헤더 (게임 상단 정보)</p>
            <ul className="text-xs text-text-secondary space-y-1.5">
              <li>• <strong>긍정률 뱃지</strong>는 Steam 전체 누적 평가가 아닌, <strong>가장 최근 이벤트 이후</strong> 유저 반응입니다.
                최신 업데이트에 대한 민심을 빠르게 확인하는 데 유용합니다.</li>
              <li>• <strong>현재 CCU</strong>는 실시간 동시 접속자 수이며, 역대 최고 기록 대비 비율로 함께 표시됩니다.</li>
              <li>• <strong>AI 현황 진단</strong>은 최근 이벤트·리뷰 데이터를 바탕으로 생성된 종합 요약입니다. 매일 새벽 자동 갱신됩니다.</li>
            </ul>
          </div>

          <div className="pl-3 border-l-2 border-accent-blue/30">
            <p className="text-xs font-semibold text-text-primary mb-1">글로벌 트래픽 (CCU) 탭</p>
            <ul className="text-xs text-text-secondary space-y-1.5">
              <li>• 시간 흐름에 따른 동시 접속자 수 변화를 확인할 수 있습니다.</li>
              <li>• <strong>주황색 배경</strong>은 할인 기간, <strong>초록색 배경</strong>은 무료 주말입니다.
                이 기간에 CCU가 급등한다면 프로모션 효과로 해석됩니다.</li>
            </ul>
            <div className="mt-2">
              <AdminBox>
                게임 등록 전 기간의 CCU 공백이 있다면, <strong>김무길</strong>에게 SteamDB CSV 업로드를 요청하세요.
                차트 우측 상단 업로드 버튼을 통해 보정 데이터를 추가할 수 있습니다.
              </AdminBox>
            </div>
          </div>

          <div className="pl-3 border-l-2 border-accent-blue/30">
            <p className="text-xs font-semibold text-text-primary mb-1">평가 추이 탭</p>
            <ul className="text-xs text-text-secondary space-y-1.5">
              <li>• 이벤트(업데이트, 패치 등)를 기준으로 나눈 각 구간의 <strong>긍정률 변화</strong>를 꺾은선 그래프로 보여줍니다.</li>
              <li>• 상단 언어 버튼으로 <strong>여러 언어권의 반응을 동시에 비교</strong>할 수 있습니다.</li>
            </ul>
            <div className="mt-2">
              <TipBox>
                한국어 라인과 영어 라인이 반대 방향으로 움직인다면, 권역별로 업데이트에 대한 반응이 다르다는 신호입니다.
              </TipBox>
            </div>
          </div>

          <div className="pl-3 border-l-2 border-accent-blue/30">
            <p className="text-xs font-semibold text-text-primary mb-1">언어권별 분포 탭</p>
            <ul className="text-xs text-text-secondary space-y-1.5">
              <li>• <strong>파이 차트</strong>: 수집된 전체 리뷰에서 언어권 분포를 보여줍니다. 상위 5개 언어 + 기타로 표시됩니다.</li>
              <li>• <strong>리스트</strong>: 각 언어별 감성률, 핵심 키워드를 확인할 수 있습니다. 상위 3개 언어만 AI 분석이 수행되며, 나머지는 '미분석'으로 표시됩니다.</li>
              <li>• 하단의 <strong>AI 언어권 교차 분석</strong>은 실제 주력 플레이 권역과 언어권 간 반응 온도차를 진단합니다.</li>
            </ul>
            <div className="mt-2">
              <TipBox>
                영어 리뷰 비율이 높아도 영미권 유저가 그만큼 많다는 뜻이 아닙니다.
                영어로 리뷰를 남기는 비영미권 유저가 많기 때문입니다.
                AI 언어권 교차 분석이 이 점을 감안해 실제 권역을 추정해줍니다.
              </TipBox>
            </div>
          </div>

        </div>
      </div>

      {/* 타임라인 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">📅 업데이트 히스토리(타임라인) 읽는 법</h3>
        <ul className="text-sm text-text-secondary space-y-2">
          <li>• 각 카드는 업데이트, 이벤트, 뉴스 1건을 나타냅니다. <strong>클릭하면</strong> 패치 요약, 유저 반응 진단, 대표 리뷰를 확인할 수 있습니다.</li>
          <li>• <span className="text-accent-blue font-medium">파란 점</span>: 공식 패치 / <span className="text-text-muted font-medium">회색 점</span>: 외부 뉴스 / <span className="text-accent-green font-medium">초록 점</span>: 무료 주말</li>
          <li>• <strong>"AI 분석 진행 전"</strong>: 분석이 아직 실행되지 않았습니다. 매일 새벽 6시경 자동 갱신됩니다.</li>
          <li>• <strong>"리뷰 부족"</strong>: 해당 기간에 수집된 리뷰 수가 너무 적어 분석 대상에서 제외됩니다. 정상적인 상태입니다.</li>
        </ul>
        <div className="mt-3 space-y-2">
          <TipBox>
            패치노트 카드에 보이는 AI 반응 요약은 해당 구간 리뷰 기반입니다.
            상단의 "AI 평가 추이 종합 진단"은 여러 구간을 가로지르는 장기 흐름을 별도로 분석한 것입니다.
          </TipBox>
          <AdminBox>
            Steam에서 잡히지 않는 서버 장애, 공지, 커뮤니티 이슈가 있다면 <strong>김무길</strong>에게
            수동 이벤트 등록을 요청하거나, 이벤트 폼에서 직접 등록할 수 있습니다 (관리자 비밀번호 필요).
          </AdminBox>
        </div>
      </div>

      {/* 데이터 갱신 주기 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">⏱️ 데이터 갱신 주기</h3>
        <Table
          headers={["데이터 종류", "갱신 시간 (KST)", "비고"]}
          rows={[
            ["현재 CCU (동접자)", "매 시간 정각", "Steam API 직접 수집"],
            ["리뷰·뉴스 수집", "매일 새벽 5시경", "신규·미수집 게임 우선"],
            ["AI 분석 결과", "매일 새벽 6시경", "수집 완료 즉시 자동 트리거"],
            ["CCU 피크타임 분석", "매주 월요일", "비용 절감을 위해 주 1회"],
          ]}
        />
        <div className="mt-3">
          <TipBox>
            대시보드가 아직 어제 데이터를 보여준다면, 새벽 6시 이후에 페이지를 새로고침 해보세요.
            캐시 갱신까지 최대 5분이 소요될 수 있습니다.
          </TipBox>
        </div>
      </div>

      {/* 관리자 기능 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">🔐 관리자 기능이 필요한 경우</h3>
        <p className="text-xs text-text-muted mb-3">아래 기능은 모두 관리자 비밀번호가 필요합니다. <strong className="text-text-secondary">김무길</strong>에게 문의하세요.</p>
        <Table
          headers={["기능", "위치", "설명"]}
          rows={[
            ["AI 분석 새로고침", "대시보드 하단", "최신 패치·뉴스 재수집 후 AI 분석 재실행. 분석 결과가 오래됐거나 누락됐을 때"],
            ["SteamDB CSV 업로드", "CCU 탭 오른쪽", "등록 전 기간 CCU 공백 보정. SteamDB에서 CSV 다운로드 후 업로드"],
            ["수동 이벤트 등록", "업데이트 히스토리 폼", "Steam에 없는 이슈·이벤트를 타임라인에 추가"],
            ["이벤트 수정", "타임라인 카드 ✏️ 버튼", "이벤트 제목·유형·날짜 수정 및 재분석"],
            ["게임 삭제", "대시보드 하단", "홈 목록에서 숨기기. 수집 데이터는 보존됨"],
          ]}
        />
      </div>

    </div>
  );

  // ── 기술 가이드 섹션들 ──────────────────────────────────────────────
  const sections: Section[] = [
    {
      id: "overview",
      title: "🔍 시스템 개요",
      content: (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            Steam Pickaxe는 Steam 게임의 리뷰·뉴스·CCU를 자동 수집하고, Gemini AI로 이벤트 구간별 유저 반응을 분석하는 데이터 파이프라인입니다.
            모든 분석 결과는 Google Sheets에 적재되며, 이 대시보드에서 시각화됩니다.
          </p>
          <Table
            headers={["구성 요소", "역할", "기술"]}
            rows={[
              ["수집 엔진", "Steam API 호출 → Google Sheets 적재", "Python / GitHub Actions"],
              ["AI 분석 엔진", "리뷰 감성 분석, 패치 요약, 추이 진단", "Google Gemini 2.5 Flash (Thinking 활성)"],
              ["데이터 저장소", "마스터 시트 + 게임별 전용 시트", "Google Sheets"],
              ["대시보드", "수집·분석 결과 시각화", "Next.js 15 / React"],
            ]}
          />
          <InfoBox color="blue">
            모든 AI 분석 결과는 현상 진단과 인과관계 추정에 한정됩니다. 지시적/주관적 권고는 생성하지 않으며,
            추정 지표를 언급할 때는 반드시 '추정치'임을 명시합니다.
          </InfoBox>
        </div>
      ),
    },
    {
      id: "schedule",
      title: "📅 자동화 스케줄",
      content: (
        <div className="space-y-4">
          <Table
            headers={["워크플로우", "실행 주기", "KST 기준", "주요 작업"]}
            rows={[
              ["collect.yml", "매일 20:00 UTC", "익일 05:00", "리뷰 수집, 뉴스/이벤트 수집, 메타데이터 갱신"],
              ["analyze.yml", "매일 21:00 UTC", "익일 06:00", "AI 분석, 브리핑 갱신, CCU 피크타임 분석"],
              ["ccu.yml", "매 시간 정각", "매 시간 +9h", "현재 동접자 수 기록"],
            ]}
          />
          <InfoBox color="green">
            새 게임 등록 후 리뷰 수집이 완료(collecting → active)되면 <Mono>analyze.yml</Mono>이 즉시 자동 트리거됩니다.
            정규 21:00 스케줄을 기다리지 않습니다.
          </InfoBox>
          <InfoBox color="yellow">
            CCU AI 피크타임 분석과 언어권 교차 분석은 매주 월요일에만 갱신됩니다. 매일 동일한 패턴 데이터에서 동일한 분석 결과가 반복 생성되는 비용 낭비를 방지하기 위한 조건부 실행입니다.
          </InfoBox>
        </div>
      ),
    },
    {
      id: "reviews",
      title: "📝 리뷰 수집",
      content: (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">API 사양</h3>
          <Table
            headers={["파라미터", "값", "이유"]}
            rows={[
              [<Mono key="e">Endpoint</Mono>, "store.steampowered.com/appreviews/{appid}", "Steam 공식 리뷰 API"],
              [<Mono key="f">filter</Mono>, "recent", "최신순 커서 기반 전체 수집"],
              [<Mono key="p">purchase_type</Mono>, "all", "스팀 구매 + 패키지 구매 모두 포함"],
              [<Mono key="l">language</Mono>, "all", "전 언어 수집 (언어별 분리는 AI 분석 단계)"],
              [<Mono key="n">num_per_page</Mono>, "80", "100 설정 시 일부 게임에서 리뷰 누락 버그 발생 — 80 고정"],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">커서 기반 페이지네이션</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• Steam API가 반환하는 <Mono>cursor</Mono> 값을 다음 요청에 전달해 전체 리뷰를 순차 수집합니다.</li>
            <li>• 현재 커서 = 이전 커서 감지 시 → 자연 고갈(수집 완료)로 판단합니다.</li>
            <li>• 1회 최대 3,000페이지(240,000건) 수집 후 커서를 저장하고 다음 실행에서 이어 수집합니다. GitHub Actions 단일 Job 실행 시 약 25분 소요됩니다.</li>
          </ul>
          <h3 className="text-sm font-semibold text-text-primary mt-4">중복·수정·삭제 처리</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• <Mono>recommendationid</Mono>가 동일하면 중복 적재하지 않습니다.</li>
            <li>• 유저가 리뷰를 <strong>수정</strong>해도 ID가 변경되지 않으므로 최초 수집 버전이 보존됩니다.</li>
            <li>• <strong>삭제된 리뷰</strong>는 수집된 이후 RAW에 계속 잔존합니다 (Steam이 삭제 신호를 보내지 않음).</li>
            <li>• Steam 표시 총 리뷰 수는 삭제분이 제외되나, RAW 수집 건수는 포함될 수 있어 일치하지 않을 수 있습니다.</li>
          </ul>
          <InfoBox color="yellow">
            Steam이 language=all 파라미터로 반환하는 total_reviews는 실제 리뷰 수보다 적을 수 있습니다.
            이 경우 수집 완료 조건을 누적 건수로 판정하면 오작동이 발생합니다. 커서 동일 감지(자연 고갈) 또는
            전체 중복 반환 감지를 주 완료 조건으로 사용합니다.
          </InfoBox>
        </div>
      ),
    },
    {
      id: "news",
      title: "📰 뉴스·이벤트 수집",
      content: (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">수집 소스</h3>
          <Table
            headers={["소스", "API", "수집 내용"]}
            rows={[
              ["GetNewsForApp", "api.steampowered.com/ISteamNews", "공식 패치노트, 외부 뉴스. enddate 페이지네이션, 최대 10,000건"],
              ["Store Events API", "store.steampowered.com/events/ajaxgetadjacentpartnerevents", "스팀 스토어 이벤트. cursor 페이지네이션으로 GetNewsForApp 누락분 보완"],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">이벤트 분류 기준</h3>
          <Table
            headers={["분류", "기준", "표시"]}
            rows={[
              ["official (공식 패치)", "feed_type=1 또는 appauthor 일치 + Store event_type 9/13/14/15/22/28", "파란 점"],
              ["news (외부 뉴스)", "feed_type=0 또는 appauthor 불일치 + Store event_type 10/12", "회색 점"],
              ["manual (수동 등록)", "관리자가 직접 등록", "파란 점"],
              ["free_weekend", "is_free_weekend=true", "초록 점"],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">content 본문 처리</h3>
          <ul className="text-sm text-text-secondary space-y-1.5">
            <li>• HTML 태그와 엔티티를 제거해 평문(plain text)으로 변환 후 저장합니다.</li>
            <li>• 최대 5,000자로 제한. 초과 시 <Mono>... [이하 생략]</Mono>이 붙습니다.</li>
            <li>• AI 패치 요약 프롬프트에 content가 있으면 본문 기반으로, 없으면 제목만으로 추정 요약합니다.</li>
          </ul>
          <InfoBox color="blue">
            AI 패치 요약은 공지 유형을 먼저 판별(UPDATE / DELAY / MAINTENANCE / EVENT / ANNOUNCEMENT)한 뒤
            유형에 맞는 방식으로 요약합니다. 지연 공지를 업데이트로 오인하는 오류를 방지합니다.
          </InfoBox>
        </div>
      ),
    },
    {
      id: "bucketing",
      title: "🪣 버킷팅 (구간 분할)",
      content: (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">
            이벤트를 기준점으로 시간축을 구간(버킷)으로 분할합니다.
            각 버킷에는 해당 기간에 작성된 Steam 리뷰가 배정됩니다.
          </p>
          <Table
            headers={["조건", "처리"]}
            rows={[
              ["이벤트 N의 버킷 범위", "이벤트 N 발생일 00:00:00 UTC ~ 다음 이벤트 전날 23:59:59 UTC"],
              ["최신 이벤트 버킷", "이벤트 발생일 ~ 분석 실행 시점"],
              ["이벤트 0개인 게임", "단일 런칭 버킷으로 전체 처리"],
              ["뉴스 이벤트(news)", "버킷 기준점이 되지 않음 — 공식/수동 이벤트만 구간 분할"],
              ["수동 이벤트 추가 시", "해당 날짜에서 기존 버킷을 2개로 분할 → 재분석"],
            ]}
          />
          <h3 className="text-sm font-semibold text-text-primary mt-4">직전 이벤트 재분석</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            새 이벤트가 추가되면 직전 버킷의 end_ts가 새 이벤트 날짜로 잘려 리뷰 수가 달라집니다.
            이를 반영하기 위해 새 이벤트 분석 시 직전 이벤트도 함께 재분석합니다.
          </p>
          <h3 className="text-sm font-semibold text-text-primary mt-4">스파스(sparse) 버킷</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            버킷 내 리뷰 수 ≤ 5건이면 감성 AI 분석을 생략하고 <Mono>sparse</Mono>로 표시합니다.
            해당 버킷의 리뷰는 다음 버킷으로 이월(carry-over)됩니다.
            공식 패치 이벤트의 경우 리뷰가 없어도 content 기반 패치 요약은 생성합니다.
          </p>
        </div>
      ),
    },
    {
      id: "ai-analysis",
      title: "🤖 AI 분석 상세",
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">모델 및 공통 원칙</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• 모델: <strong>Google Gemini 2.5 Flash</strong></li>
              <li>• <strong>Thinking 모드 활성</strong> (thinking_budget=8,192 토큰): 감성 분석·인과관계 판단 전에 내부 추론 과정을 거쳐 분석 품질을 높입니다.</li>
              <li>• 원칙: 현상 진단 + 인과관계만 서술. 지시적/주관적 어조 배제. 허구 수치 생성 금지.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">① 리뷰 샘플링 (Stratified Sampling)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              구간별 최대 2,000건 상한. 긍정/부정 원래 비율을 보존하는 계층 샘플링을 적용합니다.
            </p>
            <ul className="text-sm text-text-secondary space-y-1 mt-2">
              <li>• 전체 리뷰의 실제 긍정/부정 비율 계산</li>
              <li>• 긍정 그룹: votes_up+votes_funny 상위 1,000건 + 최신 1,000건 혼합 → 비율에 맞게 할당</li>
              <li>• 부정 그룹: 동일 전략으로 할당</li>
              <li>• 효과: 예) 전체 90% 긍정 게임의 샘플이 60% 긍정으로 왜곡되는 현상 제거 → sentiment_rate 정확도 향상</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">② 구간 감성 분석 (analyze_bucket)</h3>
            <Table
              headers={["출력 필드", "내용"]}
              rows={[
                ["sentiment_rate", "긍정 리뷰 비율 0~100%"],
                ["top_keywords", "핵심 키워드 최대 5개 (외국어는 원문+한국어 번역)"],
                ["ai_reaction_summary", "유저 반응 요약 및 주요 변동 원인 2~4문장"],
                ["top_reviews", "대표 리뷰 3건 (원문 + 한국어 번역 + 긍부정 + 언어)"],
              ]}
            />
            <p className="text-xs text-text-muted mt-2">
              분석 범위: 전체(all) + top 3 언어 각각 → 버킷당 최대 4회 Gemini 호출
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">③ 패치 요약 (analyze_patch_summary)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              공식(official) 이벤트에만 생성합니다. 공지 유형을 먼저 판별한 뒤 유형에 맞게 2~3문장 요약합니다.
            </p>
            <Table
              headers={["판별 유형", "요약 방식"]}
              rows={[
                ["UPDATE", "실제 변경된 기능·수치를 요약"],
                ["DELAY", "'○○ 업데이트의 지연 공지로...'로 시작, 지연 이유 요약"],
                ["MAINTENANCE", "점검 내용과 범위 요약"],
                ["EVENT", "이벤트 내용과 기간 요약"],
                ["ANNOUNCEMENT", "예고된 내용 요약"],
              ]}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">④ 평가 추이 종합 진단 (sentiment_trend_comment)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              2개 이상 버킷이 분석된 경우, 전체 구간에 걸친 감성률 변화 패턴을 종합 진단합니다.
              단순히 최신 구간 요약을 재사용하는 것이 아닌, 전체 추이를 독립적으로 분석합니다.
            </p>
            <ul className="text-sm text-text-secondary space-y-1 mt-2">
              <li>• 전체 추이 방향 (상승/하락/안정/변동성 큼)</li>
              <li>• 주요 전환점과 원인 추정</li>
              <li>• 최근 기조와 장기 트렌드 비교</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">⑤ CCU 피크타임 분석 (generate_ccu_peaktime_comment)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              전체 CCU 데이터를 KST 기준 24시간 평균으로 집약한 뒤, 피크 시간대 패턴으로 주력 플레이 권역을 추정합니다.
              <strong> 매주 월요일에만 갱신</strong>됩니다 (비용 절감 목적).
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">⑥ 언어권 교차 분석 (generate_language_cross_analysis)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              RAW 리뷰 전체의 언어 분포와 각 언어별 평균 감성률을 종합합니다.
              Steam 영어 과대표집 문제를 감안해 실제 주력 권역과 권역 간 평가 온도차를 진단합니다.
              <strong> 매주 월요일에만 갱신</strong>됩니다.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">⑦ AI 브리핑 (generate_ai_briefing)</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              최근 10개 구간의 날짜·제목·긍정률·리뷰수·요약을 종합하고 최근 3건 vs 이전 3건 추이 방향을 계산한 뒤,
              게임 전반 현황을 3~5문장으로 진단합니다. 매일 갱신됩니다.
            </p>
          </div>

          <InfoBox color="yellow">
            <strong>분석 언어 수:</strong> 기본적으로 상위 3개 언어만 언어별 감성 분석이 수행됩니다.
            나머지 언어는 리뷰 분포(파이 차트)에는 표시되지만 AI 감성 분석 데이터는 없습니다.
            언어 수를 늘리면 Gemini API 비용이 언어 수 × 이벤트 수만큼 증가합니다.
          </InfoBox>
        </div>
      ),
    },
    {
      id: "metrics",
      title: "📊 지표 해석 가이드",
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">긍정률 (sentiment_rate)</h3>
            <Table
              headers={["범위", "해석", "배지 색상"]}
              rows={[
                ["80% 이상", "압도적으로 긍정적 — 주요 불만 요소가 적음", "초록"],
                ["70~79%", "대체로 긍정적 — 일부 불만 존재하나 호평 우세", "연두"],
                ["40~69%", "복합적 — 긍부정 의견이 혼재, 특정 문제 주목 필요", "주황"],
                ["39% 이하", "부정적 — 광범위한 불만 또는 구조적 문제 가능성", "빨강"],
              ]}
            />
            <InfoBox color="yellow">
              <strong>주의:</strong> 헤더의 긍정률은 Steam 전체 누적 평가가 아닌 <strong>가장 최근 이벤트 구간의 긍정률</strong>입니다.
              최근 업데이트 이후의 반응을 반영합니다. Steam 스토어 페이지의 종합 평가와 다를 수 있습니다.
            </InfoBox>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">CCU (Current Concurrent Users)</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• Steam API를 매 시간 정각에 호출한 실시간 동접자 수입니다.</li>
              <li>• 할인 기간(주황 배경)과 무료 주말(초록 배경)이 차트에 표시됩니다.</li>
              <li>• Peak CCU는 SteamSpy에서 수집한 역대 최대 동접자 추정치입니다.</li>
              <li>• 게임 등록 이전 기간의 CCU는 SteamDB CSV를 업로드해 보정할 수 있습니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">언어 분포</h3>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• RAW 리뷰 전체(수집된 모든 리뷰)의 언어 분포를 보여줍니다.</li>
              <li>• 파이 차트는 상위 5개 언어 + 기타로 표시됩니다.</li>
              <li>• 리스트의 감성률/키워드는 AI가 분석한 언어(top 3)만 표시됩니다. 그 외는 "(미분석)"으로 표시됩니다.</li>
              <li>• Steam 리뷰는 영어 리뷰가 과대표집되는 경향이 있습니다. AI 언어권 교차 분석은 이를 감안해 실제 주력 권역을 추정합니다.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">타임라인 카드 상태</h3>
            <Table
              headers={["상태", "의미"]}
              rows={[
                ["AI 분석 진행 전", "이 구간의 AI 분석이 아직 실행되지 않았습니다"],
                ["리뷰 부족 (N건)", "구간 내 리뷰가 ≤5건 — 통계적으로 의미 있는 분석 불가"],
                ["소수 리뷰", "분석은 되었으나 리뷰 수가 매우 적어 결과의 신뢰도가 낮습니다"],
                ["긍정률 배지", "클릭하면 패치 요약, 유저 반응, 대표 리뷰를 펼쳐볼 수 있습니다"],
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: "data-quality",
      title: "⚠️ 데이터 한계 및 주의사항",
      content: (
        <div className="space-y-4">
          <InfoBox color="red">
            <strong>Steam 리뷰 API 한계:</strong> Steam이 language=all 파라미터로 반환하는 총 리뷰 수가
            실제보다 적게 표시되는 경우가 있습니다. 이 경우 수집 건수와 Steam 표시 건수가 불일치할 수 있습니다.
          </InfoBox>
          <InfoBox color="yellow">
            <strong>리뷰 수정 미반영:</strong> 유저가 리뷰를 수정해도 recommendationid는 변경되지 않으므로
            최초 수집 시점의 리뷰 내용이 보존됩니다.
          </InfoBox>
          <InfoBox color="yellow">
            <strong>삭제 리뷰 잔존:</strong> 수집 이후 삭제된 리뷰는 RAW 시트에 계속 남습니다.
            Steam이 삭제 신호를 별도 제공하지 않습니다.
          </InfoBox>
          <InfoBox color="yellow">
            <strong>CCU 공백 구간:</strong> 게임 등록 이전 기간 및 시스템 다운 기간은 CCU 수집이 불가합니다.
            SteamDB CSV를 업로드해 공백을 보정할 수 있습니다.
          </InfoBox>
          <InfoBox color="blue">
            <strong>AI 분석 신뢰도:</strong> AI 분석 결과는 수집된 리뷰 샘플 기반의 통계적 추정이며
            모든 유저 의견을 반영하지 않습니다. 특히 리뷰 수가 적은 구간(sparse)은 결과 신뢰도가 낮습니다.
          </InfoBox>
          <InfoBox color="blue">
            <strong>content 잘림:</strong> 이벤트 본문이 5,000자를 초과하면 잘립니다.
            패치노트의 하위 항목이 AI 요약에서 누락될 수 있습니다.
          </InfoBox>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">영어 과대표집 문제</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Steam 리뷰는 영어 리뷰 비율이 실제 플레이어 분포보다 높은 경향이 있습니다.
              한국·중국·일본 게임도 영어 리뷰가 전체의 20~40%를 차지하는 경우가 흔합니다.
              언어권별 감성률 분석 시 이 점을 감안해 해석하세요.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "cost",
      title: "💰 비용 추정",
      content: (
        <div className="space-y-4">
          <p className="text-text-secondary text-sm">Gemini 2.5 Flash 기준 (2026년 4월 기준)</p>
          <Table
            headers={["요금 항목", "단가", "비고"]}
            rows={[
              ["입력 토큰", "$0.075 / 1M tokens", "Thinking 토큰 포함 (동일 요금)"],
              ["출력 토큰", "$0.30 / 1M tokens", ""],
            ]}
          />
          <InfoBox color="yellow">
            <strong>Thinking 토큰:</strong> Thinking 모드 활성 시 모델 내부 추론 과정이 thinking 토큰으로 과금됩니다.
            현재 thinking_budget=8,192 토큰으로 설정되어 있으며, 호출당 실제 사용량은 작업 복잡도에 따라 0~8,192 토큰 범위로 결정됩니다.
          </InfoBox>
          <h3 className="text-sm font-semibold text-text-primary mt-4">게임 1개 기준 일일 비용 추정</h3>
          <Table
            headers={["작업", "Gemini 호출 수", "입력 토큰 추정 (thinking 포함)", "비용 추정"]}
            rows={[
              ["구간 분석 (신규 1개, 4언어)", "4회", "~20,000", "~$0.005"],
              ["패치 요약", "1회", "~5,000", "~$0.001"],
              ["한국어 제목 생성", "1회", "~2,000", "<$0.001"],
              ["추이 종합 진단", "1회", "~7,000", "~$0.001"],
              ["AI 브리핑", "1회", "~8,000", "~$0.001"],
              ["CCU 피크타임 (주 1회)", "1/7회", "~5,000", "~$0.001/주"],
              ["언어 교차 분석 (주 1회)", "1/7회", "~6,000", "~$0.001/주"],
            ]}
          />
          <InfoBox color="green">
            이미 분석된 구간은 skip됩니다. 안정기(신규 이벤트 없음)에는 하루 브리핑 1회 + 트렌드 분석 1회만
            실행되어 <strong>일일 $0.003~0.008 수준</strong>으로 유지됩니다 (thinking 토큰 포함).
          </InfoBox>
          <InfoBox color="yellow">
            신규 게임 등록 후 첫 분석 시에는 모든 구간을 한꺼번에 분석하므로 일시적으로
            이벤트 수 × $0.008~0.015 수준의 비용이 발생합니다 (thinking 토큰 포함).
          </InfoBox>
        </div>
      ),
    },
  ];

  const allSectionIds = ["user-guide", ...sections.map((s) => s.id)];

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">분석 방법 가이드</h1>
          <p className="text-text-secondary text-sm">
            Steam Pickaxe의 데이터 수집 기준, AI 분석 방식, 지표 해석 주의사항을 상세하게 안내합니다.
          </p>
        </div>
        <Link href="/" className="text-xs text-accent-blue hover:underline">← 홈으로</Link>
      </div>

      <div className="flex gap-6">
        {/* 사이드바 네비게이션 */}
        <div className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-6 space-y-1">
            {/* 이용 안내 버튼 — 사이드바 최상단 */}
            <button
              onClick={() => setActiveSection("user-guide")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === "user-guide"
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-accent-green/5 text-accent-green/70 border border-accent-green/20 hover:bg-accent-green/10"
              }`}
            >
              📖 이용 안내
            </button>

            <div className="pt-2 pb-1">
              <div className="border-t border-border-default" />
              <p className="text-[10px] text-text-muted px-1 pt-2">기술 가이드</p>
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
            <button
              onClick={() => setActiveSection("user-guide")}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                activeSection === "user-guide"
                  ? "bg-accent-green text-white"
                  : "bg-bg-card border border-accent-green/30 text-accent-green/70 hover:text-accent-green"
              }`}
            >
              📖 이용 안내
            </button>
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

          {/* 이용 안내 패널 */}
          <div className={activeSection === "user-guide" ? "block" : "hidden"}>
            <div className="bg-bg-card border border-accent-green/20 rounded-xl p-6">
              <h2 className="text-lg font-bold text-text-primary mb-1">📖 이용 안내</h2>
              <p className="text-xs text-text-muted mb-6">대시보드를 처음 사용하는 분들을 위한 설명서입니다.</p>
              {userGuideContent}
            </div>
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
