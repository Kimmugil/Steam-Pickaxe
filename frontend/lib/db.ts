import postgres from "postgres";

/**
 * Supabase 데이터베이스 연결 (서버에서만 사용).
 * 서버리스 환경에서는 접속 수가 쉽게 늘어나므로, 세션 풀러(5432) 주소가 들어와도 트랜잭션 풀러(6543)로 바꿔 씁니다.
 */
function connectionUrl(): string {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) return "postgres://localhost:5432/missing"; // 빌드 때 환경변수가 없어도 죽지 않도록 (실제 질의 때 오류)
  return url.replace(/:5432\//, ":6543/");
}

declare global {
  // eslint-disable-next-line no-var
  var __sp_sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__sp_sql ??
  (globalThis.__sp_sql = postgres(connectionUrl(), {
    prepare: false, // 트랜잭션 풀러에서는 prepared statement를 쓸 수 없음
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    types: { bigint: postgres.BigInt },
  }));

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** postgres.js 가 돌려주는 bigint(BigInt)·Date 를 화면으로 넘길 수 있는 평범한 값으로 바꿉니다. */
export function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x)));
}
