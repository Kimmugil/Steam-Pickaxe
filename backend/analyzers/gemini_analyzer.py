"""
Gemini 2.5 Flash API — 리뷰 분석, 키워드 추출, AI 브리핑 생성
기획서 4장 AI 분석 원칙: 현상 진단 + 인과관계만, 지시적 어조 금지
"""
import json
import time
import google.generativeai as genai
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"

LANGUAGE_NAMES = {
    "all": "전체",
    "koreana": "한국어",
    "english": "영어",
    "schinese": "중국어(간체)",
    "tchinese": "중국어(번체)",
    "japanese": "일본어",
    "russian": "러시아어",
    "french": "프랑스어",
    "german": "독일어",
    "spanish": "스페인어",
    "brazilian": "포르투갈어(브라질)",
}

ANALYSIS_SYSTEM_PROMPT = """당신은 Steam 게임 리뷰 분석 전문가입니다.
규칙:
1. 현상 진단과 인과관계 분석만 수행하세요.
2. '권장합니다', '조치가 필요합니다' 등 지시적/주관적 어조를 절대 사용하지 마세요.
3. 데이터에 없는 수치, 가짜 날짜, 가짜 URL을 생성하지 마세요.
4. SteamSpy 추정 지표를 언급할 때는 반드시 '추정치'임을 명시하세요.
5. 응답은 반드시 유효한 JSON으로만 출력하세요. 마크다운 코드블록 없이 순수 JSON."""


def analyze_bucket(game_name: str, event_title: str, reviews: list[dict], language_scope: str) -> dict:
    """
    단일 구간+언어 조합 분석
    반환: {sentiment_rate, top_keywords, ai_reaction_summary, top_reviews}
    """
    if not reviews:
        return _empty_analysis()

    lang_name = LANGUAGE_NAMES.get(language_scope, language_scope)
    reviews_text = _format_reviews(reviews[:2000])

    prompt = f"""게임: {game_name}
이벤트/구간: {event_title}
분석 언어: {lang_name} (언어 코드: {language_scope})
총 분석 리뷰 수: {len(reviews)}건

아래 리뷰 데이터를 분석하여 JSON으로 응답하세요:

{{
  "sentiment_rate": <긍정 리뷰 비율 0~100 숫자>,
  "top_keywords": [<핵심 키워드 최대 5개. 외국어는 "원문 (한국어 번역)" 형식으로>],
  "ai_reaction_summary": "<유저 반응 요약 및 주요 변동 원인 진단. 2~4문장. 지시적 어조 금지>",
  "top_reviews": [
    {{
      "text": "<원문>",
      "text_kr": "<한국어 번역 (한국어 원문이면 동일)>",
      "voted_up": true/false,
      "language": "<언어코드>"
    }}
  ]
}}

리뷰 데이터:
{reviews_text}"""

    result = _call_gemini(prompt)
    return result if result else _empty_analysis()


def generate_event_title_kr(
    game_name: str,
    title: str,
    event_type: str,
    patch_summary: str = "",
) -> str:
    """
    이벤트 한국어 제목 생성.
    버전 번호가 있으면 앞에 유지하고, 핵심 변경사항을 한국어로 요약한다.
    예) "v0.20.10 던전 업데이트 : 바닥·층 개편 및 섬 컨셉 추가"
    """
    context = (
        f"패치 내용 요약 (참고):\n{patch_summary}"
        if patch_summary
        else "(패치 요약 없음 — 원제만으로 판단)"
    )

    prompt = f"""게임명: {game_name}
이벤트 유형: {event_type}
원제 (영문): {title}
{context}

위 정보를 바탕으로 한국어 이벤트 제목을 생성하세요.

규칙:
- 버전 번호가 있으면 맨 앞에 그대로 표기 (예: v0.20.10)
- 콜론(:)으로 버전/유형과 내용을 구분
- 핵심 변경사항을 한국어로 간결하게 표현 (전체 40자 이내)
- 좋은 예: "v0.20.10 던전 업데이트 : 바닥·층 개편 및 섬 컨셉 추가"
- 좋은 예: "v0.7.5 신규 콘텐츠 : 길드 시스템 및 양조 레시피 추가"
- 좋은 예: "주말 특가 이벤트"
- 텍스트만 반환, JSON/마크다운 없이."""

    model = genai.GenerativeModel(MODEL)
    try:
        resp = model.generate_content(prompt)
        return resp.text.strip()[:60]
    except Exception as e:
        print(f"[gemini] title_kr 오류: {e}")
        return ""


def analyze_patch_summary(game_name: str, event_title: str, patch_url: str) -> str:
    """패치 내용 AI 요약 (공식 패치노트 URL 기반)"""
    prompt = f"""게임: {game_name}
패치명: {event_title}
패치노트 URL: {patch_url}

이 패치의 주요 변경 사항을 2~3문장으로 객관적으로 요약하세요.
지시적 어조 없이 변경 내용만 서술하세요.
URL에 접근할 수 없다면 패치명만으로 추정 가능한 범위에서 서술하고, 추정임을 명시하세요.
JSON 없이 텍스트만 반환하세요."""

    model = genai.GenerativeModel(MODEL)
    try:
        resp = model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"[gemini] patch_summary 오류: {e}")
        return ""


def generate_ai_briefing(game_name: str, timeline_summary: str) -> str:
    """게임 전체 현황 AI 브리핑 (일 단위 갱신)"""
    prompt = f"""게임: {game_name}

아래는 이 게임의 업데이트 히스토리와 유저 반응 요약 데이터입니다.
이 데이터를 바탕으로 현재 게임의 전반적인 현황을 3~5문장으로 진단하세요.

규칙:
- 현상과 인과관계만 서술하세요
- 지시적 어조 금지
- 추정 지표 사용 시 '추정치' 명시
- JSON 없이 텍스트만 반환

데이터:
{timeline_summary}"""

    model = genai.GenerativeModel(MODEL)
    try:
        resp = model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"[gemini] briefing 오류: {e}")
        return ""


def generate_ccu_peaktime_comment(game_name: str, ccu_data: list[dict]) -> str:
    """CCU 피크타임 분석 — 주력 플레이 권역 추정"""
    if not ccu_data:
        return ""

    summary = _summarize_ccu_by_hour(ccu_data)
    prompt = f"""게임: {game_name}

아래는 시간대별 평균 CCU 데이터(KST 기준)입니다.
이 패턴을 기반으로 주력 플레이 권역을 추정하세요.
2~3문장, 지시적 어조 금지, JSON 없이 텍스트만 반환.

{summary}"""

    model = genai.GenerativeModel(MODEL)
    try:
        resp = model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"[gemini] ccu_peaktime 오류: {e}")
        return ""


def generate_language_cross_analysis(game_name: str, language_stats: list[dict], ccu_peak_comment: str) -> str:
    """언어권 교차 분석 AI 코멘트"""
    prompt = f"""게임: {game_name}

언어권별 리뷰 비중 데이터:
{json.dumps(language_stats, ensure_ascii=False, indent=2)}

CCU 피크타임 분석:
{ccu_peak_comment}

스팀 영어 과대표집 문제를 감안하여 실제 주력 권역과 권역 간 평가 온도차를 진단하세요.
3~4문장, 지시적 어조 금지, JSON 없이 텍스트만 반환."""

    model = genai.GenerativeModel(MODEL)
    try:
        resp = model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"[gemini] lang_cross 오류: {e}")
        return ""


def _call_gemini(prompt: str, retries: int = 3) -> dict | None:
    model = genai.GenerativeModel(
        MODEL,
        system_instruction=ANALYSIS_SYSTEM_PROMPT,
    )
    for attempt in range(retries):
        try:
            resp = model.generate_content(prompt)
            text = resp.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"[gemini] JSON 파싱 오류 시도 {attempt+1}: {e}")
        except Exception as e:
            print(f"[gemini] API 오류 시도 {attempt+1}: {e}")
            time.sleep(5 * (attempt + 1))
    return None


def _format_reviews(reviews: list[dict]) -> str:
    lines = []
    for r in reviews:
        # voted_up can be Python bool (True/False) OR a string ("True"/"False")
        # gspread sometimes returns strings depending on cell format.
        # "False" is truthy in Python, so we must compare explicitly.
        voted_raw = r.get("voted_up", False)
        is_positive = voted_raw is True or str(voted_raw).upper() == "TRUE"
        voted = "긍정" if is_positive else "부정"
        lang = r.get("language", "")
        text = str(r.get("review", ""))[:500]
        lines.append(f"[{voted}][{lang}] {text}")
    return "\n".join(lines)


def _empty_analysis() -> dict:
    return {
        "sentiment_rate": 0,
        "top_keywords": [],
        "ai_reaction_summary": "",
        "top_reviews": [],
    }


def _summarize_ccu_by_hour(ccu_data: list[dict]) -> str:
    from datetime import datetime, timezone, timedelta
    KST = timedelta(hours=9)
    hourly: dict[int, list[int]] = {h: [] for h in range(24)}
    for row in ccu_data:
        try:
            ts = row.get("timestamp", "")
            if isinstance(ts, str):
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00")) + KST
            else:
                dt = datetime.fromtimestamp(int(ts), tz=timezone.utc) + KST
            hourly[dt.hour].append(int(row.get("ccu_value", 0)))
        except Exception:
            continue
    lines = []
    for h in range(24):
        vals = hourly[h]
        avg = int(sum(vals) / len(vals)) if vals else 0
        lines.append(f"KST {h:02d}시: 평균 {avg:,}명")
    return "\n".join(lines)
