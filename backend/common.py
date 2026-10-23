"""공통 도구: 환경 설정, DB 연결, Steam 요청(재시도), 작업 기록(점검 시각)"""
import contextlib
import json
import os
import time
from datetime import datetime, timezone

try:  # 회사 PC처럼 인증서를 가로채는 네트워크에서 윈도우 인증서를 쓰도록 (없어도 무방)
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

import psycopg
import requests
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, "..", ".env"))

UTC = timezone.utc
USER_AGENT = "steam-pickaxe/2.0 (+personal research tracker)"

# Steam이 요청 제한(429)을 걸면 이 값만큼 요청 사이 간격을 늘리고, 잘 풀리면 조금씩 줄입니다.
THROTTLE = {"penalty": 0.0}


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def connect(autocommit: bool = True) -> psycopg.Connection:
    """DB에 접속합니다. 접속이 끊기지 않도록 유지 신호를 보냅니다."""
    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        raise RuntimeError("SUPABASE_DB_URL 이 설정되어 있지 않습니다. (.env 또는 GitHub Secrets)")
    last = None
    for attempt in range(4):
        try:
            return psycopg.connect(dsn, autocommit=autocommit, connect_timeout=30,
                                   keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5)
        except psycopg.OperationalError as e:
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def get_json(url: str, params: dict | None = None, retries: int = 6, timeout: int = 30, quiet: bool = False):
    """Steam 요청. 일시 오류나 요청 제한(429)이면 기다렸다가 다시 시도하고, 끝내 실패하면 None."""
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers={"User-Agent": USER_AGENT}, allow_redirects=False)
            if 300 <= r.status_code < 400 or r.status_code == 429 or r.status_code >= 500:
                # 3xx: Steam이 요청이 너무 많다고 보고 메인 페이지로 돌려보내는 '일시 차단' 신호 (JSON이 아님)
                if r.status_code == 429 or 300 <= r.status_code < 400:
                    THROTTLE["penalty"] = min(THROTTLE["penalty"] + 0.5, 4.0)
                wait = min(15 * (attempt + 1), 90) if r.status_code != 302 else min(60 * (attempt + 1), 240)
                if not quiet:
                    print(f"  [steam] 상태 {r.status_code} - {wait}초 쉬고 다시 시도 ({attempt + 1}/{retries})", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            wait = min(5 * (attempt + 1), 45)
            if not quiet:
                print(f"  [steam] {type(e).__name__} - {wait}초 쉬고 다시 시도 ({attempt + 1}/{retries})", flush=True)
            time.sleep(wait)
    return None


class JobRun:
    """job_runs 표에 '시작 → 끝(성공/실패)'을 남깁니다. 관리자 현황판의 '마지막 점검 시각'이 여기서 나옵니다.
    작업 중 DB 연결이 끊겨도 기록은 남도록, 시작과 끝에서 각각 따로 접속합니다."""

    def __init__(self, name: str):
        self.name = name
        self.summary: dict = {}
        with connect() as c:
            # 같은 종류의 작업이 새로 시작됐다면 이전에 끝나지 않은 기록은 중간에 끊긴 것(컴퓨터 꺼짐 등)으로 정리
            c.execute("""update job_runs set finished_at = now(), ok = false, error = '비정상 종료(전원·네트워크 끊김 등)로 끝 기록이 없음'
                         where job = %s and finished_at is null""", (name,))
            c.execute("delete from job_runs where started_at < now() - interval '90 days'")   # 오래된 기록 정리
            self.id = c.execute("insert into job_runs (job) values (%s) returning id", (name,)).fetchone()[0]

    def finish(self, ok: bool, error: str | None = None):
        with connect() as c:
            c.execute(
                "update job_runs set finished_at = now(), ok = %s, summary = %s::jsonb, error = %s where id = %s",
                (ok, json.dumps(self.summary, ensure_ascii=False, default=str), (error or "")[:1000] or None, self.id))


@contextlib.contextmanager
def job(name: str):
    run = JobRun(name)
    try:
        yield run
    except Exception as e:  # 실패해도 기록은 남기고, 오류는 그대로 다시 던져 Actions가 실패로 표시하게 함
        run.finish(False, f"{type(e).__name__}: {e}")
        raise
    else:
        run.finish(True)
