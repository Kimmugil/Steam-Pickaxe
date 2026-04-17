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

function rowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = row[i] ?? ""));
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

// ── timeline_{appid} ──────────────────────────────────

export async function getTimeline(appid: string): Promise<TimelineRow[]> {
  try {
    const rows = await readSheet(`timeline_${appid}`);
    return rowsToRecords(rows) as unknown as TimelineRow[];
  } catch {
    return [];
  }
}

export async function appendTimelineRow(appid: string, row: Partial<TimelineRow>) {
  const sheets = await getSheetsClient();
  const headers = [
    "event_id","event_type","date","title","language_scope",
    "sentiment_rate","review_count","ai_patch_summary","ai_reaction_summary",
    "top_keywords","top_reviews","url","is_sale_period","sale_text","is_free_weekend",
  ];
  const values = headers.map((h) => String((row as Record<string, unknown>)[h] ?? ""));
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `timeline_${appid}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

export async function deleteTimelineRowsByEventId(appid: string, eventId: string) {
  const sheets = await getSheetsClient();
  const rows = await readSheet(`timeline_${appid}`);

  const tabInfo = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = tabInfo.data.sheets?.find(
    (s) => s.properties?.title === `timeline_${appid}`
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
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }
}

// ── ccu_{appid} ───────────────────────────────────────

export async function getCcuData(appid: string): Promise<CcuRow[]> {
  try {
    const rows = await readSheet(`ccu_${appid}`);
    return rowsToRecords(rows) as unknown as CcuRow[];
  } catch {
    return [];
  }
}

export async function appendCcuRows(appid: string, newRows: string[][]) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `ccu_${appid}`,
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
