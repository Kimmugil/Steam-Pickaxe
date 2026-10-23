import os
import truststore; truststore.inject_into_ssl()
import psycopg, requests
from dotenv import load_dotenv
here = os.path.dirname(os.path.abspath(__file__)); load_dotenv(os.path.join(here, "..", ".env"))
with psycopg.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20) as c:
    off = [r[0] for r in c.execute("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")]
    print("tables_without_RLS:", off)
    anon = c.execute("select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')").fetchone()[0]
    print("anon/authenticated grants on public tables:", anon)
from urllib.parse import urlparse
_u = urlparse(os.environ["SUPABASE_URL"].strip()); url = _u.scheme + "://" + _u.netloc; key = os.environ["SUPABASE_SECRET_KEY"]
h = {"apikey": key, "Authorization": "Bearer " + key}
r = requests.get(url + "/rest/v1/games?select=appid&limit=1", headers=h, timeout=20)
print("REST secret-key read games:", r.status_code, r.text[:80])
