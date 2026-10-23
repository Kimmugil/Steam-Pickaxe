-- Steam Pickaxe v2 데이터베이스 설계 (Supabase / PostgreSQL)
-- 여러 번 실행해도 안전하도록 "없을 때만 만들기" 방식으로 작성했습니다.
-- 모든 표는 서버(비밀 키)만 읽고 쓰며, 방문자 브라우저가 직접 접근하지 못합니다.

-- ───────────────────────── 게임 ─────────────────────────
create table if not exists games (
  appid                bigint primary key,
  name                 text not null,
  thumbnail            text,                          -- Steam 공식 대표 이미지 주소(header_image)
  status               text not null default 'collecting'
                         check (status in ('collecting','active','archived','error')),
  release_date         date,
  release_date_text    text,                          -- Steam이 준 원문 (파싱 실패 대비)
  genres               text[] not null default '{}',
  developer            text,
  publisher            text,
  price                text,
  is_free              boolean,
  is_early_access      boolean,
  steam_total_reviews  integer,                       -- Steam이 말하는 전체 리뷰 수 (수집률 계산용)
  steam_positive_rate  numeric(5,2),                  -- Steam 누적 긍정률
  tier                 text not null default 'hot' check (tier in ('hot','mid','calm','idle')),
  tier_override        text check (tier_override in ('hot','mid','calm','idle')),
  review_cursor        text,                          -- 끊겼을 때 이어받을 Steam 커서
  last_probe_at        timestamptz,                   -- 마지막 "새 리뷰 있나" 점검
  last_probe_total     integer,
  last_collected_at    timestamptz,
  next_collect_at      timestamptz,
  reviews_collected    integer not null default 0,    -- 아래 세 값은 집계 함수가 갱신
  reviews_with_playtime integer not null default 0,
  latest_review_at     timestamptz,
  top_languages        text[] not null default '{}',
  ai_enabled           boolean not null default true, -- false면 수집만 하고 AI 분석은 건너뜀
  pinned               boolean not null default false,
  ccu_history_imported boolean not null default false,-- SteamDB CSV로 과거 동접을 올렸는지
  collection_started_at timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

-- ───────────────────────── 리뷰 원문 ─────────────────────────
create table if not exists reviews (
  appid                  bigint not null references games(appid) on delete cascade,
  recommendationid       bigint not null,
  voted_up               boolean not null,
  language               text,
  review                 text,
  created_at             timestamptz not null,
  updated_at             timestamptz,
  playtime_at_review     integer,                     -- 리뷰 쓸 때까지의 플레이타임(분)
  playtime_forever       integer,                     -- 지금까지 누적 플레이타임(분)
  playtime_last_two_weeks integer,
  last_played            timestamptz,                 -- 작성자가 마지막으로 실행한 시점 (observed_at 시점의 값)
  votes_up               integer not null default 0,
  weighted_vote_score    real,
  steam_purchase         boolean,
  received_for_free      boolean,
  written_during_early_access boolean,
  refunded               boolean,
  observed_at            timestamptz,                 -- 위 필드들을 Steam에서 읽은 시각
  primary key (appid, recommendationid)
);
create index if not exists reviews_appid_created_idx on reviews (appid, created_at desc);

-- 날짜 · 언어별 긍정/부정 집계 (급변 감지와 차트가 이 표를 씁니다)
create table if not exists review_daily (
  appid     bigint not null references games(appid) on delete cascade,
  day       date   not null,
  language  text   not null default '',
  pos       integer not null default 0,
  neg       integer not null default 0,
  primary key (appid, day, language)
);

-- ───────────────────────── 이벤트(사실) ─────────────────────────
create table if not exists events (
  id          bigint generated always as identity primary key,
  appid       bigint not null references games(appid) on delete cascade,
  event_key   text   not null,                        -- Steam 공지 번호 또는 수동 입력 고유값
  type        text   not null check (type in ('official','news','manual','free_weekend','launch','sale')),
  event_date  date   not null,
  title       text   not null,
  title_kr    text,
  url         text,
  content     text,
  ai_summary  text,
  sale_text   text,
  created_at  timestamptz not null default now(),
  unique (appid, event_key)
);
create index if not exists events_appid_date_idx on events (appid, event_date desc);

-- ───────────────────────── AI·계산 분석 결과 ─────────────────────────
-- kind: monthly(월간) / weekly(주간) / shift(평가 급변) / event_impact(업데이트 영향)
-- scope: 'all' 또는 언어 코드(koreana 등)
create table if not exists analyses (
  id            bigint generated always as identity primary key,
  appid         bigint not null references games(appid) on delete cascade,
  kind          text   not null check (kind in ('monthly','weekly','shift','event_impact')),
  period_key    text   not null,                      -- 예: 2026-04 / 2026-W15 / shift 시작일
  scope         text   not null default 'all',
  period_start  date,
  period_end    date,
  title         text,
  sentiment_rate numeric(5,2),
  review_count  integer,
  is_sparse     boolean not null default false,       -- 리뷰가 너무 적어 AI를 생략한 구간
  reaction_summary text,
  keywords      jsonb not null default '[]',
  top_reviews   jsonb not null default '[]',
  extra         jsonb not null default '{}',          -- 급변: 변화폭·방향·신뢰도, 영향: 전후 지표 등
  input_fingerprint text,                             -- 분석에 쓴 데이터 지문 (낡았는지 판단용)
  model         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (appid, kind, period_key, scope)
);
create index if not exists analyses_appid_kind_idx on analyses (appid, kind, period_start desc);

-- 게임 단위 AI 리포트 (브리핑·추이·동접·언어권·수명주기를 종류별로 보관)
create table if not exists game_reports (
  appid        bigint not null references games(appid) on delete cascade,
  kind         text   not null check (kind in ('briefing','trend','ccu','language_cross','lifecycle','report')),
  body         text,
  generated_at timestamptz not null default now(),
  input_fingerprint text,
  primary key (appid, kind)
);

-- ───────────────────────── 동접 · 긍정률 · 가격 ─────────────────────────
create table if not exists ccu_samples (
  appid      bigint not null references games(appid) on delete cascade,
  sampled_at timestamptz not null,
  ccu        integer not null,
  source     text not null default 'live' check (source in ('live','steamdb')),
  primary key (appid, sampled_at)
);

create table if not exists rate_history (
  appid          bigint not null references games(appid) on delete cascade,
  day            date   not null,
  positive_rate  numeric(5,2),
  total_reviews  integer,
  primary key (appid, day)
);

create table if not exists price_history (
  appid            bigint not null references games(appid) on delete cascade,
  day              date   not null,
  price_final      integer,
  discount_percent integer,
  primary key (appid, day)
);

-- 긍정 리뷰어 중 최근 접속 비율 (달마다 같은 표본을 다시 확인한 결과)
create table if not exists active_stats (
  appid       bigint not null references games(appid) on delete cascade,
  month       text   not null,
  band        text   not null,                        -- lt2 / 2to10 / 10to100 / 100to300 / gt300
  sample_n    integer not null,
  active_n    integer not null,
  primary key (appid, month, band)
);

-- ───────────────────────── 운영: 자동 복구 · 점검 · 요청 · 문구 ─────────────────────────
create table if not exists analysis_tasks (
  id          bigint generated always as identity primary key,
  appid       bigint not null references games(appid) on delete cascade,
  kind        text   not null,
  period_key  text   not null default '',
  scope       text   not null default 'all',
  status      text   not null default 'pending' check (status in ('pending','running','done','failed','skipped')),
  attempts    integer not null default 0,
  last_error  text,
  input_fingerprint text,
  updated_at  timestamptz not null default now(),
  unique (appid, kind, period_key, scope)
);

create table if not exists job_runs (
  id          bigint generated always as identity primary key,
  job         text not null,                          -- collect / ccu / analyze / backup ...
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  summary     jsonb not null default '{}',
  error       text
);
create index if not exists job_runs_job_idx on job_runs (job, started_at desc);

create table if not exists game_requests (
  appid       bigint primary key,
  name        text not null,
  meta        text,
  request_count integer not null default 1,
  memo        text,
  status      text not null default 'open' check (status in ('open','approved','held')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ui_texts (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ───────────────────────── 집계 함수 ─────────────────────────
create or replace function refresh_review_daily(p_appid bigint) returns void
language sql as $$
  delete from review_daily where appid = p_appid;
  insert into review_daily (appid, day, language, pos, neg)
  select appid, (created_at at time zone 'UTC')::date, coalesce(language, ''),
         count(*) filter (where voted_up), count(*) filter (where not voted_up)
  from reviews where appid = p_appid
  group by 1, 2, 3;
$$;

-- 최근 구간만 다시 집계 (수집 도중에도 최신 지표가 맞도록, 가볍게)
create or replace function refresh_review_daily_range(p_appid bigint, p_since date) returns void
language sql as $$
  delete from review_daily where appid = p_appid and day >= p_since;
  insert into review_daily (appid, day, language, pos, neg)
  select appid, (created_at at time zone 'UTC')::date, coalesce(language, ''),
         count(*) filter (where voted_up), count(*) filter (where not voted_up)
  from reviews where appid = p_appid and created_at >= p_since::timestamptz
  group by 1, 2, 3;
$$;

create or replace function refresh_game_counts(p_appid bigint) returns void
language sql as $$
  update games g set
    reviews_collected     = s.n,
    reviews_with_playtime = s.n_pt,
    latest_review_at      = s.latest,
    top_languages = coalesce((
      select array_agg(language order by c desc) from (
        select language, count(*) c from reviews
        where appid = p_appid and language is not null group by language order by c desc limit 5
      ) t), '{}')
  from (
    select count(*) n, count(playtime_forever) n_pt, max(created_at) latest
    from reviews where appid = p_appid
  ) s
  where g.appid = p_appid;
$$;

-- 게임별 계산 지표 스냅샷 (홈·상세 화면이 이 한 줄만 읽으면 되도록 매일 미리 계산해 둠)
create table if not exists game_metrics (
  appid       bigint primary key references games(appid) on delete cascade,
  computed_at timestamptz not null default now(),
  metrics     jsonb not null
);

-- 관리자 로그인 시도 기록 (연속 실패 잠금용). 접속 주소는 해시로만 저장합니다.
create table if not exists admin_login_attempts (
  id      bigint generated always as identity primary key,
  ip_hash text not null,
  ok      boolean not null,
  at      timestamptz not null default now()
);
create index if not exists admin_login_attempts_idx on admin_login_attempts (ip_hash, at desc);

-- AI 호출 사용량 (월 한도 관리용)
create table if not exists ai_usage (
  day          date primary key,
  calls        integer not null default 0,
  input_tokens bigint  not null default 0,
  output_tokens bigint not null default 0
);

-- 주간(최근 4주)·월간 브리핑 보관
create table if not exists briefs (
  period       text primary key,            -- 예: w4:2026-10-19 (최근 4주, 기준 월요일) / m:2026-09 (월간 확정)
  body         jsonb not null,
  generated_at timestamptz not null default now()
);

-- 수집기가 쓰는 추가 열 (이미 있으면 건너뜀)
alter table games add column if not exists last_collected_total integer;   -- 마지막 수집 때 Steam이 말한 전체 리뷰 수
alter table games add column if not exists ai_since date;                    -- 이 날짜 이후 구간만 AI 분석 (비우면 출시부터)

-- ───────────────────────── 권한 ─────────────────────────
-- "새 표 자동 공개"를 껐기 때문에, 서버용 열쇠(service_role)에만 명시적으로 권한을 줍니다.
-- 방문자용 열쇠(anon, authenticated)에는 아무 권한도 주지 않습니다.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- 방문자용 열쇠(anon, authenticated)에는 기본으로 붙는 권한도 모두 회수합니다. (RLS와 이중 잠금)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
