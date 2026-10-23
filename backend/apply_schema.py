"""db/schema.sql 을 Supabase에 적용하고 결과 표 목록을 보여 줍니다. (여러 번 실행해도 안전)"""
import os, sys
import truststore; truststore.inject_into_ssl()
import psycopg
from dotenv import load_dotenv

here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(here, "..", ".env"))
dsn = os.environ["SUPABASE_DB_URL"]
sql = open(os.path.join(here, "..", "db", "schema.sql"), encoding="utf-8").read()

with psycopg.connect(dsn, connect_timeout=20) as c:
    c.execute(sql)
    c.commit()
    rows = c.execute("""
        select c.relname, c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1
    """).fetchall()
    print("표 %d개 생성/확인:" % len(rows))
    for name, rls in rows:
        print("  -", name, "(RLS 켜짐)" if rls else "(RLS 꺼짐!)")
