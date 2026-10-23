"""Supabase 연결 확인 (값은 출력하지 않고 성공/실패만 알려 줍니다)"""
import os, sys
from dotenv import load_dotenv
import truststore; truststore.inject_into_ssl()
import requests, psycopg

here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(here, "..", ".env"))

def has(k): return bool(os.environ.get(k, "").strip())
print("채워진 항목:", {k: has(k) for k in ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_DB_URL"]})

url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
if url and key:
    try:
        r = requests.get(url + "/rest/v1/", headers={"apikey": key, "Authorization": "Bearer " + key}, timeout=20)
        print("API 연결:", "성공" if r.status_code == 200 else "실패 (상태 %s)" % r.status_code)
    except Exception as e:
        print("API 연결: 실패 (%s)" % type(e).__name__)

dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
if dsn:
    try:
        with psycopg.connect(dsn, connect_timeout=20) as c:
            row = c.execute("select version(), current_database(), pg_size_pretty(pg_database_size(current_database()))").fetchone()
            print("DB 연결: 성공 |", row[0].split(",")[0], "| DB 크기", row[2])
    except Exception as e:
        print("DB 연결: 실패 (%s)" % type(e).__name__, str(e).split("\n")[0][:120].replace(dsn, "***"))
