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
  "title_kr",
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

/**
 * 특정 event_id의 타임라인 행 필드를 업데이트합니다.
 * title / title_kr / date / event_type / url 등 공유 필드는 모든 language_scope 행에 반영합니다.
 * sentiment_rate 등 스코프별 필드는 "all" 행에만 반영합니다.
 */
export async function updateTimelineEventField(
  appid: string,
  eventId: string,
  updates: Partial<TimelineRow>,
  gameSheetId?: string
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = gameSheetId ?? SPREADSHEET_ID;
  const tabName = gameSheetId ? "timeline" : `timeline_${appid}`;

  const rows = await (gameSheetId
    ? readGameSheet(gameSheetId, tabName)
    : readSheet(tabName));

  const headers = rows[0] ?? [];

  // 모든 language_scope 행에 공통으로 적용할 필드
  const SHARED_FIELDS = new Set([
    "title", "title_kr", "date", "event_type",
    "url", "is_sale_period", "sale_text", "is_free_weekend",
  ]);

  const batchData: { range: string; values: string[][] }[] = [];

  rows.forEach((row, rowIdx) => {
    if (rowIdx === 0 || row[0] !== eventId) return;
    const scopeColIdx = headers.indexOf("language_scope");
    const scope = scopeColIdx >= 0 ? (row[scopeColIdx] ?? "") : "";

    for (const [key, val] of Object.entries(updates)) {
      // 공유 필드는 모든 스코프에, 그 외는 "all" 스코프에만 적용
      if (!SHARED_FIELDS.has(key) && scope !== "all") continue;

      const colIdx = headers.indexOf(key);
      if (colIdx < 0) continue;

      const colLetter = String.fromCharCode(65 + colIdx);
      batchData.push({
        range: `${tabName}!${colLetter}${rowIdx + 1}`,
        values: [[String(val ?? "")]],
      });
    }
  });

  if (batchData.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: batchData as never },
  });
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

const SHEET_CELL_LIMIT = 10_000_000;
const CCU_TAB_CELLS = 1000 * 5; // 추가할 ccu 탭: 1000행 × 5열

/**
 * 개별 게임 시트에 "ccu" 탭이 없으면 생성하고 헤더를 추가합니다.
 *
 * 탭 추가 전 현재 총 셀 수를 계산하고, 한도 초과 위험이 있으면
 * 그리드 크기가 큰 탭들을 실제 데이터 행 수에 맞게 축소합니다.
 */
async function ensureCcuTab(spreadsheetId: string) {
  const sheets = await getSheetsClient();

  // 현재 탭 목록 + gridProperties 조회
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheetList = meta.data.sheets ?? [];
  const titles = sheetList.map((s) => s.properties?.title ?? "");

  // 현재 총 셀 수 계산
  const totalCells = sheetList.reduce((sum, s) => {
    const r = s.properties?.gridProperties?.rowCount ?? 0;
    const c = s.properties?.gridProperties?.columnCount ?? 0;
    return sum + r * c;
  }, 0);

  // 한도 초과 위험이 있으면 대형 탭들을 실제 데이터 크기로 축소
  if (totalCells + CCU_TAB_CELLS > SHEET_CELL_LIMIT) {
    const resizeRequests: object[] = [];

    for (const s of sheetList) {
      const rowCount = s.properties?.gridProperties?.rowCount ?? 0;
      const colCount = s.properties?.gridProperties?.columnCount ?? 0;
      // 그리드가 100K 셀 이하인 탭은 건드리지 않음
      if (rowCount * colCount <= 100_000) continue;

      const title = s.properties?.title ?? "";

      // A열만 읽어 실제 데이터 행 수 파악 (빈 행은 반환 안 됨)
      let dataRows = 0;
      try {
        const colA = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${title}!A:A`,
        });
        dataRows = (colA.data.values ?? []).length;
      } catch {
        // 읽기 실패 시 보수적으로 5000행으로 처리
        dataRows = 5000;
      }

      const targetRows = Math.max(dataRows + 50, 100);
      const targetCols = colCount; // 열 수는 유지

      if (targetRows < rowCount) {
        resizeRequests.push({
          updateSheetProperties: {
            properties: {
              sheetId: s.properties!.sheetId,
              gridProperties: { rowCount: targetRows, columnCount: targetCols },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount",
          },
        });
      }
    }

    if (resizeRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: resizeRequests },
      });
    }
  }

  if (!titles.includes("ccu")) {
    // 탭 생성 — gridProperties를 최소로 지정해 셀 한도 초과 방지
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: "ccu",
              gridProperties: { rowCount: 1000, columnCount: 5 },
            },
          },
        }],
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

/**
 * ui_text 탭을 FALLBACK 기준으로 완전 재작성합니다 (Full Reset).
 *
 * - FALLBACK에 있는 키만 남김 (미사용 키 자동 제거)
 * - Sheets에 커스텀 값이 있으면 그 값을 유지
 * - Sheets에 없는 신규 키는 FALLBACK 기본값으로 추가
 * - 탭 전체를 clear 후 정렬된 순서로 재작성
 *
 * @returns {{ kept: number; added: number; removed: number }}
 */
export async function resetUiText(
  fallback: Record<string, string>
): Promise<{ kept: number; added: number; removed: number }> {
  const sheets = await getSheetsClient();

  // 현재 ui_text 탭 읽기 (커스텀 값 보존을 위해)
  let rows: string[][] = [];
  try {
    rows = await readSheet("ui_text");
  } catch {
    // 탭 없으면 빈 배열
  }

  // 기존 key→value 맵 파싱 (커스텀 값)
  const existingMap: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    const key = row[0]?.trim();
    if (key) existingMap[key] = row[1] ?? "";
  }

  // 새 탭 내용 구성: FALLBACK 키 순서 유지, 커스텀 값 우선
  const newRows: string[][] = [["key", "value"]];
  let kept = 0;
  let added = 0;

  for (const [key, defaultVal] of Object.entries(fallback)) {
    if (key in existingMap) {
      // 기존 값 보존 (빈 값이면 기본값 사용)
      newRows.push([key, existingMap[key] || defaultVal]);
      kept++;
    } else {
      // 신규 키 — 기본값 사용
      newRows.push([key, defaultVal]);
      added++;
    }
  }

  // 제거 대상: Sheets에 있지만 FALLBACK에 없는 키
  const removed = Object.keys(existingMap).filter((k) => !(k in fallback)).length;

  // 탭 전체 클리어 후 재작성
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "ui_text",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "ui_text!A1",
    valueInputOption: "RAW",
    requestBody: { values: newRows },
  });

  return { kept, added, removed };
}
