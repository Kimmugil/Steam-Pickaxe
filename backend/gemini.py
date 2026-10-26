"""Gemini 호출 도우미: 재시도, JSON 파싱, 사용량 기록, 월 호출 한도"""
import json
import os
import re
import time

from google import genai
from google.genai import types

from common import now_utc

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_MONTHLY_CALL_CAP = 600

SYSTEM_PROMPT = """당신은 Steam 게임 리뷰를 분석하는 전문가입니다. 아래 규칙을 반드시 지킵니다.
1. 현상 진단과 원인의 가능성만 서술합니다. '권장합니다', '조치가 필요합니다' 같은 지시나 제안은 쓰지 않습니다.
2. 원인은 단정하지 않고 '~로 보인다', '~했을 가능성이 있다'처럼 쓰며, 근거가 된 리뷰의 내용을 구체적으로 언급합니다.
3. 데이터에 없는 수치, 날짜, 주소, 리뷰 내용을 만들어 내지 않습니다. 표본에 없는 비율을 지어내지 않습니다.
4. 모든 문장은 '~다' 체로 통일합니다. '~합니다', '~입니다' 같은 경어체를 섞지 않습니다.
5. 리뷰는 전체가 아닌 일부 표본입니다. 표본 기준임을 전제로 서술하되, 표본이 잘렸다거나 데이터 품질이 낮다는 말은 하지 않습니다.
6. 동접자 수는 Steam 한 곳의 수치입니다. 다른 플랫폼(콘솔, 모바일, 자체 런처)으로 옮겨 갔다고 단정하지 않습니다.
7. 외국어 키워드는 '원문 (한국어 번역)' 형식으로 씁니다.
8. 반드시 요청한 JSON 형식만 출력합니다."""


class BudgetExceeded(Exception):
    """이번 달 AI 호출 한도에 도달"""


_client = None


def client():
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GEMINI_API_KEY 가 설정되어 있지 않습니다.")
        _client = genai.Client(api_key=key)
    return _client


def monthly_cap(conn) -> int:
    r = conn.execute("select value from app_settings where key = 'ai_monthly_call_cap'").fetchone()
    try:
        return int(r[0]) if r else DEFAULT_MONTHLY_CALL_CAP
    except ValueError:
        return DEFAULT_MONTHLY_CALL_CAP


def month_calls(conn) -> int:
    first = now_utc().date().replace(day=1)
    return int(conn.execute("select coalesce(sum(calls), 0) from ai_usage where day >= %s", (first,)).fetchone()[0])


def _record(conn, in_tok: int, out_tok: int):
    conn.execute("""insert into ai_usage (day, calls, input_tokens, output_tokens) values (current_date, 1, %s, %s)
                    on conflict (day) do update set calls = ai_usage.calls + 1,
                    input_tokens = ai_usage.input_tokens + excluded.input_tokens,
                    output_tokens = ai_usage.output_tokens + excluded.output_tokens""", (in_tok, out_tok))


def _parse(text: str):
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = t.rsplit("```", 1)[0]
    try:
        # strict=False: 문자열 안에 줄바꿈·탭 같은 제어 문자가 그대로 들어와도 받아들입니다
        # (Gemini가 가끔 그렇게 내보내서 "Invalid control character" 오류로 분석이 통째로 실패했음)
        return json.loads(t, strict=False)
    except json.JSONDecodeError:
        return json.loads(re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", t), strict=False)


def generate_json(conn, prompt: str, retries: int = 3) -> dict:
    """JSON 객체 하나를 돌려받습니다. 실패하면 예외(호출한 쪽이 작업 실패로 기록)."""
    if month_calls(conn) >= monthly_cap(conn):
        raise BudgetExceeded(f"이번 달 AI 호출 한도({monthly_cap(conn)}회)에 도달했습니다.")
    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT, response_mime_type="application/json", temperature=0.4,
        thinking_config=types.ThinkingConfig(thinking_budget=0))
    last = None
    for attempt in range(retries):
        try:
            resp = client().models.generate_content(model=MODEL, contents=prompt, config=cfg)
            um = getattr(resp, "usage_metadata", None)
            _record(conn, getattr(um, "prompt_token_count", 0) or 0, getattr(um, "candidates_token_count", 0) or 0)
            data = _parse(resp.text)
            if not isinstance(data, dict):
                raise ValueError("JSON 객체가 아님")
            return data
        except (json.JSONDecodeError, ValueError) as e:
            last = e
        except Exception as e:          # 일시 오류 · 요청 제한 등
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Gemini 호출 실패: {type(last).__name__}: {str(last)[:200]}")
