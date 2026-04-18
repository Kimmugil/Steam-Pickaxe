import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { Game, TimelineRow, CcuRow, ConfigMap } from "@/types";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: SCOPES,
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.MASTER_SPREADSHEET_ID!;

// ── 범용 탭 읽기 ──────────────────────────────────────

async function readSheet(tabName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: tabName,
  });
  return (res.data.values ?? []) as string[][];
}

/** 개별 게임 시트(game_sheet_id)에서 특정 탭 읽기 */
async function readGameSheet(sheetId: string, tabName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,
  });
  return (res.data.values ?? []) as string[][];
}

// Sheets에서 읽은 "TRUE"/"FALSE"/"True"/"False" 문자열을 실제 boolean으로 변환
const BOOL_FIELDS = new Set(["is_free", "is_early_access", "is_sale_period", "is_free_weekend", "is_archived_gap"]);

function parseCellValue(key: string, raw: string): string | boolean {
  if (BOOL_FIELDS.has(key)) {
    const upper = raw.toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
  }
  return raw;
}

function rowsToRecords(rows: string[][]): Record<string, string | boolean>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const rec: Record<string, string | boolean> = {};
    headers.forEach((h, i) => (rec[h] = parseCellValue(h, row[i] ?? "")));
    return rec;
  });
}

// ── config ────────────────────────────────────────────

export async function getConfig(): Promise<ConfigMap> {
  const rows = await readSheet("config");
  const map: ConfigMap = {};
  rows.slice(1).forEach((r) => {
    if (r[0]) map[r[0]] = r[1] ?? "";
  });
  return map;
}

export async function setConfigValue(key: string, value: string) {
  const sheets = await getSheetsClient();
  const rows = await readSheet("config");
  const rowIndex = rows.findIndex((r) => r[0] === key);
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `config!B${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
  }
}

// ── games ─────────────────────────────────────────────

export async function getAllGames(): Promise<Game[]> {
  const rows = await readSheet("games");
  return rowsToRecords(rows) as unknown as Game[];
}

// 개별 게임 시트에서 CCU 데이터 읽기 (game_sheet_id 기반)
export async function getCcuDataFromGameSheet(sheetId: string): Promise<CcuRow[]> {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "ccu",
    });
    const rows = (res.data.values ?? []) as string[][];
    return rowsToRecords(rows) as unknown as CcuRow[];
  } catch {
    return [];
  }
}

export async function getGame(appid: string): Promise<Game | null> {
  const games = await getAllGames();
  return games.find((g) => String(g.appid) === String(appid)) ?? null;
}

export async function appendGame(game: Partial<Game>) {
  const sheets = await getSheetsClient();
  const headers = await readSheet("games").then((r) => r[0]);
  const row = headers.map((h) => String((game as Record<string, unknown>)[h] ?? ""));
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "games",
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export async function updateGame(appid: string, updates: Partial<Game>) {
  const sheets = await getSheetsClient();
  const rows = await readSheet("games");
  const headers = rows[0];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === String(appid));
  if (rowIndex < 0) throw new Error(`appid ${appid} not found`);

  const batchData = Object.entries(updates)
    .map(([key, val]) => {
      const colIdx = headers.indexOf(key);
      if (colIdx < 0) return null;
      const col = String.fromCharCode(65 + colIdx);
      return {
        range: `games!${col}${rowIndex + 1}`,
        values: [[String(val ?? "")]],
      };
    })
    .filter(Boolean);

  if (batchData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: batchData as never,
      },
    });
  }
}

// ── timeline (개별 게임 시트 우선, 마스터 시트 폴백) ──

const TIMELINE_HEADERS = [
  "event_id","event_type","date","title","language_scope",
  "sentiment_rate","review_count","ai_patch_summary","ai_reaction_summary",
  "top_keywords","top_reviews","url","is_sale_period","sale_text","is_free_weekend",
];

/**
 * 타임라인 조회.
 * gameSheetId가 있으면 개별 게임 시트의 "timeline" 탭을 읽는다.
 * 없으면 마스터 시트의 "timeline_{appid}" 탭으로 폴백한다.
 */
export async function getTimeline(appid: string, gameSheetId?: string): Promise<TimelineRow[]> {
  try {
    const rows = gameSheetId
      ? await readGameSheet(gameSheetId, "timeline")
      : await readSheet(`timeline_${appid}`);
    return rowsToRecords(rows) as unknown as TimelineRow[];
  } catch {
    return [];
  }
}

/**
 * 타임라인 행 추가.
 * gameSheetId가 있으면 개별 게임 시트에 쓴다.
 */
export async function appendTimelineRow(
  appid: string,
  row: Partial<TimelineRow>,
  gameSheetId?: string,
) {
  const sheets = await getSheetsClient();
  const values = TIMELINE_HEADERS.map((h) => String((row as Record<string, unknown>)[h] ?? ""));
  await sheets.spreadsheets.values.append({
    spreadsheetId: gameSheetId ?? SPREADSHEET_ID,
    range: gameSheetId ? "timeline" : `timeline_${appid}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

/**
 * 이벤트 ID 기준으로 타임라인 행 삭제.
 * gameSheetId가 있으면 개별 게임 시트에서 삭제한다.
 */
export async function deleteTimelineRowsByEventId(
  appid: string,
  eventId: string,
  gameSheetId?: string,
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = gameSheetId ?? SPREADSHEET_ID;
  const tabName = gameSheetId ? "timeline" : `timeline_${appid}`;
  const rows = await (gameSheetId
    ? readGameSheet(gameSheetId, tabName)
    : readSheet(tabName));

  const tabInfo = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = tabInfo.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  if (!sheet?.properties?.sheetId) return;

  const sheetId = sheet.properties.sheetId;
  const toDelete = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i > 0 && r[0] === eventId)
    .map(({ i }) => i)
    .sort((a, b) => b - a);

  const requests = toDelete.map((rowIdx) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowIdx,
        endIndex: rowIdx + 1,
      },
    },
  }));

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

// ── ccu (개별 게임 시트 우선, 마스터 시트 폴백) ─────────

/**
 * CCU 데이터 조회.
 * gameSheetId가 있으면 개별 게임 시트의 "ccu" 탭을 읽는다.
 * 없으면 마스터 시트의 "ccu_{appid}" 탭으로 폴백(레거시).
 */
export async function getCcuData(appid: string, gameSheetId?: string): Promise<CcuRow[]> {
  try {
    const rows = gameSheetId
      ? await readGameSheet(gameSheetId, "ccu")
      : await readSheet(`ccu_${appid}`);
    return rowsToRecords(rows) as unknown as CcuRow[];
  } catch {
    return [];
  }
}

/**
 * 개별 게임 시트에 "ccu" 탭이 없으면 생성하고 헤더를 추가합니다.
 */
async function ensureCcuTab(spreadsheetId: string) {
  const sheets = await getSheetsClient();

  // 현재 탭 목록 조회
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets ?? []).map(
    (s) => s.properties?.title ?? ""
  );

  if (!titles.includes("ccu")) {
    // 탭 생성
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "ccu" } } }],
      },
    });
    // 헤더 행 추가
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "ccu!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["timestamp", "ccu_value", "is_sale_period", "is_free_weekend", "is_archived_gap"]],
      },
    });
  }
}

/**
 * CCU 행 일괄 추가.
 * gameSheetId가 있으면 개별 게임 시트에 쓴다.
 * ccu 탭이 없으면 자동 생성한다.
 */
export async function appendCcuRows(appid: string, newRows: string[][], gameSheetId?: string) {
  const sheets = await getSheetsClient();
  const spreadsheetId = gameSheetId ?? SPREADSHEET_ID;
  const range = gameSheetId ? "ccu" : `ccu_${appid}`;

  // 개별 게임 시트의 경우 탭 존재 여부를 확인하고 없으면 생성
  if (gameSheetId) {
    await ensureCcuTab(gameSheetId);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: newRows },
  });
}

// ── ui_text (CMS) ─────────────────────────────────────
// Google Sheets의 ui_text 탭을 읽어 { key: value } 맵으로 반환.
// unstable_cache로 60초 TTL 캐싱 — Sheets API 호출 횟수 최소화.

async function _fetchUiText(): Promise<Record<string, string>> {
  try {
    const rows = await readSheet("ui_text");
    const map: Record<string, string> = {};
    // 헤더 행(row[0]) 제외, key/value 파싱
    rows.slice(1).forEach((r) => {
      if (r[0]?.trim()) map[r[0].trim()] = r[1] ?? "";
    });
    return map;
  } catch {
    // ui_text 탭이 아직 없거나 API 오류 → 빈 객체 반환 (폴백 처리는 클라이언트)
    return {};
  }
}

export const getUiText = unstable_cache(_fetchUiText, ["ui-text"], {
  revalidate: 60, // 60초마다 Sheets에서 재조회
});

/**
 * ui_text 탭에 누락된 키를 일괄 추가합니다.
 * 이미 존재하는 키(값이 있는)는 덮어쓰지 않아 관리자 커스텀 값을 보존합니다.
 *
 * @param fallback  FALLBACK 키-값 맵 (UiTextContext의 FALLBACK 객체)
 * @returns {{ added: number; skipped: number }}
 */
export async function syncUiText(
  fallback: Record<string, string>
): Promise<{ added: number; skipped: number }> {
  const sheets = await getSheetsClient();

  // 현재 ui_text 탭 읽기
  let rows: string[][] = [];
  try {
    rows = await readSheet("ui_text");
  } catch {
    // 탭이 없으면 빈 배열로 처리
  }

  // 헤더가 없으면 헤더 행 먼저 추가
  if (rows.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "ui_text",
      valueInputOption: "RAW",
      requestBody: { values: [["key", "value"]] },
    });
    rows = [["key", "value"]];
  }

  // 기존 키 집합 (값이 있는 키만 — 빈 값 키는 덮어쓰기 대상)
  const existingKeys = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row[0]?.trim() && row[1]?.trim()) {
      existingKeys.add(row[0].trim());
    }
  }

  // 누락 키 수집
  const toAdd: string[][] = [];
  for (const [key, value] of Object.entries(fallback)) {
    if (!existingKeys.has(key)) {
      toAdd.push([key, value]);
    }
  }

  if (toAdd.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "ui_text",
      valueInputOption: "RAW",
      requestBody: { values: toAdd },
    });
  }

  return { added: toAdd.length, skipped: existingKeys.size };
}
