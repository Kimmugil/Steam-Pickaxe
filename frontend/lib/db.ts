import postgres from "postgres";

/**
 * Supabase 데이터베이스 연결 (서버에서만 사용).
 * 반드시 '세션 풀러'(포트 5432)로 접속합니다. 트랜잭션 풀러(6543)는 한 화면에서 질의가 연결 수보다 많이 몰리면
 * 연결 묶음 전체가 멈추고 복구되지 않는 현상이 실험으로 확인됐습니다(2026-10). 대신 서버 한 곳당 연결을 1개만 쓰고 놀면 곧 닫아서
 * 세션 풀러의 총 연결 한도(15개, 다른 사이트와 같이 씀)를 아낍니다.
 */
function connectionUrl(): string {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) return "postgres://localhost:5432/missing"; // 빌드 때 환경변수가 없어도 죽지 않도록 (실제 질의 때 오류)
  return url.replace(/:6543\//, ":5432/");
}

declare global {
  // eslint-disable-next-line no-var
  var __sp_sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__sp_sql ??
  (globalThis.__sp_sql = postgres(connectionUrl(), {
    prepare: false, // 풀러 환경에서 이름 붙은 prepared statement 는 쓰지 않음
    max: 1,
    idle_timeout: 3,
    connect_timeout: 15,
    types: { bigint: postgres.BigInt },
  }));

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** postgres.js 가 돌려주는 bigint(BigInt)·Date 를 화면으로 넘길 수 있는 평범한 값으로 바꿉니다. */
export function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x)));
}
