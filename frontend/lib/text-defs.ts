/** 관리자가 고칠 수 있는 화면 문구. 기본값은 코드에 있고, 고친 값만 DB(ui_texts)에 저장됩니다. */
export interface TextDef {
  key: string;
  group: "home" | "badge" | "game" | "common";
  label: string;
  where: string;
  def: string;
  multi?: boolean;
  /** 위치 지도: [화면, x, y, 너비, 높이, 점선 여부] */
  spot: ["home" | "game", number, number, number, number, ("dash" | "")?];
  tabHint?: string;
}

export const GROUPS: { id: TextDef["group"]; title: string }[] = [
  { id: "home", title: "홈 화면" },
  { id: "badge", title: "진단 배지 (이름과 마우스를 올렸을 때 설명)" },
  { id: "game", title: "게임 상세 화면" },
  { id: "common", title: "공통" },
];

export const TEXT_DEFS: TextDef[] = [
  { key: "site_title", group: "home", label: "사이트 이름", where: "모든 화면 왼쪽 위 로고 옆", def: "Steam Pickaxe", spot: ["home", 10, 9, 64, 12] },
  { key: "hl_title", group: "home", label: "'이번 주 주목' 제목", where: "홈 맨 위 첫 번째 구역의 제목", def: "이번 주 주목", spot: ["home", 6, 33, 52, 10] },
  { key: "hl_sub", group: "home", label: "'이번 주 주목' 설명", where: "그 제목 오른쪽의 작은 글씨", def: "지난 7일 동안 가장 크게 움직인 항목", spot: ["home", 62, 33, 104, 10] },
  { key: "games_title", group: "home", label: "'전체 게임' 제목", where: "게임 카드 목록 바로 위", def: "전체 게임", spot: ["home", 6, 83, 44, 10] },
  { key: "brief_title", group: "home", label: "브리핑 패널 제목", where: "홈 오른쪽 패널의 맨 위", def: "최근 4주 브리핑", spot: ["home", 256, 38, 58, 9] },
  { key: "brief_tab_w4", group: "home", label: "브리핑 패널 첫째 탭 이름", where: "패널 제목 아래 왼쪽 탭", def: "최근 4주", spot: ["home", 256, 50, 46, 11] },
  { key: "brief_tab_m", group: "home", label: "브리핑 패널 둘째 탭 이름", where: "패널 제목 아래 오른쪽 탭", def: "지난달 리포트", spot: ["home", 304, 50, 46, 11] },
  { key: "empty_games", group: "home", label: "게임이 하나도 없을 때 안내", where: "카드가 표시되는 자리 (등록된 게임이 없거나 필터 결과가 없을 때)", def: "조건에 맞는 게임이 없습니다. 게임은 관리자가 추가하면 이곳에 표시됩니다.", multi: true, spot: ["home", 10, 150, 232, 40, "dash"] },
  { key: "first_title", group: "home", label: "처음 방문 안내 창의 제목", where: "처음 접속했을 때 한 번 뜨는 안내 창", def: "Steam Pickaxe에 오신 것을 환영합니다", spot: ["home", 84, 68, 110, 10, "dash"] },
  { key: "first_body", group: "home", label: "처음 방문 안내 창의 본문", where: "그 안내 창의 설명 글", def: "Steam 게임의 평가와 접속 흐름을 꾸준히 모아 변화가 생긴 게임을 알려 드립니다.", multi: true, spot: ["home", 84, 82, 196, 36, "dash"] },
  { key: "diag_healthy_name", group: "badge", label: "'건강' 배지 이름", where: "게임 카드 이미지 왼쪽 위 배지", def: "건강", spot: ["home", 9, 117, 26, 9] },
  { key: "diag_healthy_help", group: "badge", label: "'건강' 배지 설명", where: "배지에 마우스를 올렸을 때 나오는 말풍선", def: "평가가 좋고 접속도 활발한 상태입니다.", multi: true, spot: ["home", 9, 128, 46, 12, "dash"] },
  { key: "diag_quiet_name", group: "badge", label: "'조용한 이탈' 배지 이름", where: "게임 카드 이미지 왼쪽 위 배지", def: "조용한 이탈", spot: ["home", 70, 117, 26, 9] },
  { key: "diag_quiet_help", group: "badge", label: "'조용한 이탈' 배지 설명", where: "배지에 마우스를 올렸을 때 나오는 말풍선", def: "평가는 좋게 유지되지만, 실제로 접속하는 사람이 줄어드는 상태입니다.", multi: true, spot: ["home", 70, 128, 46, 12, "dash"] },
  { key: "diag_angry_name", group: "badge", label: "'불만' 배지 이름", where: "게임 카드 이미지 왼쪽 위 배지", def: "불만", spot: ["home", 131, 117, 26, 9] },
  { key: "diag_angry_help", group: "badge", label: "'불만' 배지 설명", where: "배지에 마우스를 올렸을 때 나오는 말풍선", def: "평가가 떨어지는데 리뷰는 오히려 늘어나는 상태입니다.", multi: true, spot: ["home", 131, 128, 46, 12, "dash"] },
  { key: "diag_cool_name", group: "badge", label: "'침체' 배지 이름", where: "게임 카드 이미지 왼쪽 위 배지", def: "침체", spot: ["home", 192, 117, 26, 9] },
  { key: "diag_cool_help", group: "badge", label: "'침체' 배지 설명", where: "배지에 마우스를 올렸을 때 나오는 말풍선", def: "평가와 접속이 함께 낮아지는 상태입니다.", multi: true, spot: ["home", 192, 128, 46, 12, "dash"] },
  { key: "sum_title", group: "game", label: "요약 카드 제목", where: "게임 상세 맨 위 요약 카드의 가운데 제목", def: "한눈 요약", spot: ["game", 58, 72, 40, 8] },
  { key: "ai_tag", group: "game", label: "'AI가 쓴 글' 표시", where: "요약 카드 제목 옆의 작은 표시", def: "AI 요약 · 주 1회 갱신", spot: ["game", 100, 72, 56, 8] },
  { key: "tl_sub", group: "game", label: "타임라인 설명", where: "'타임라인' 제목 오른쪽의 작은 글씨", def: "무슨 일이 있었고, 전후 7일에 무엇이 달라졌는지", spot: ["game", 60, 132, 100, 9] },
  { key: "impact_help", group: "game", label: "반응 유형 안내", where: "타임라인 필터 아래의 작은 설명 (반등형·무반응형·역풍형이 무슨 뜻인지)", def: "반응 유형: 반등형은 업데이트 뒤 리뷰 속도나 동접이 올랐고, 무반응형은 변화가 거의 없었으며, 역풍형은 긍정률이 5%p 이상 내려간 경우입니다. 전후 7일을 비교합니다.", multi: true, spot: ["game", 130, 144, 150, 10] },
  { key: "ccu_missing_notice", group: "game", label: "동접 과거 데이터 없음 안내", where: "상세 분석 > 접속 탭, 출시 이후 기록이 비어 있을 때 맨 위", def: "수집을 시작하기 전의 동접 기록이 없습니다. 과거 기록이 필요하면 관리자에게 문의해 주세요.", multi: true, spot: ["game", 14, 220, 332, 10], tabHint: "접속 탭" },
  { key: "lang_note", group: "game", label: "언어권 탭 안내", where: "상세 분석 > 언어권 탭 맨 위 (AI 해설이 어떤 언어에 붙는지)", def: "AI 해설은 한국어와 리뷰가 가장 많은 상위 3개 언어에만 붙습니다. 나머지 언어는 수치만 보여 주고, 표본이 너무 적으면 해설을 생략합니다.", multi: true, spot: ["game", 14, 233, 332, 8], tabHint: "언어권 탭" },
  { key: "lang_small", group: "game", label: "'표본 부족' 안내", where: "언어권 탭 표에서 리뷰가 너무 적은 언어의 해설 칸", def: "해설을 생략했습니다", spot: ["game", 14, 244, 150, 8], tabHint: "언어권 탭" },
  { key: "active_help", group: "game", label: "활성 리뷰어 설명", where: "상세 분석 > 활성 리뷰어 탭 아래 설명", def: "리뷰를 수집한 시점에 작성자가 최근 30일 안에 게임을 실행했는지를 봅니다. 마지막 접속 정보는 수집한 때부터 쌓입니다.", multi: true, spot: ["game", 14, 255, 160, 8], tabHint: "활성 리뷰어 탭" },
  { key: "kw_help", group: "game", label: "키워드 표 설명", where: "상세 분석 > 평가·반응 탭의 '키워드 × 플레이타임' 표 아래", def: "같은 불만이 게임을 얼마나 해 본 사람에게서 나오는지 보여 줍니다. 최근 90일 리뷰 기준이며, 외국어 키워드는 원문으로 찾습니다.", multi: true, spot: ["game", 190, 255, 150, 8], tabHint: "평가·반응 탭" },
  { key: "foot", group: "common", label: "하단 안내문", where: "모든 화면 맨 아래", def: "AI 분석은 리뷰 일부를 뽑아 요약한 결과이며 원인을 단정하지 않습니다. 동접자는 Steam 한 곳의 수치이고 다른 플랫폼은 포함되지 않습니다.", multi: true, spot: ["home", 6, 238, 240, 9] },
];

export type Texts = Record<string, string>;
