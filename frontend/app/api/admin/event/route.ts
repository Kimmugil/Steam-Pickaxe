import { NextRequest, NextResponse } from "next/server";
import { getConfig, appendTimelineRow, deleteTimelineRowsByEventId, getTimeline, getGame, updateTimelineEventField } from "@/lib/sheets";
import { v4 as uuidv4 } from "uuid";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

export async function POST(req: NextRequest) {
  try {
    const { appid, title, date, url, content, password } = await req.json();
    if (!appid || !title || !date || !password) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 비밀번호 확인 + 게임 시트 ID 조회 (병렬)
    const [config, game] = await Promise.all([
      getConfig(),
      getGame(String(appid)),
    ]);
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const gameSheetId = game?.game_sheet_id;

    // 수동 이벤트 추가 (url, content 포함)
    const newEventId = uuidv4();
    await appendTimelineRow(String(appid), {
      event_id: newEventId,
      event_type: "manual",
      date,
      title,
      url: url ?? "",
      content: content ?? "",   // Sheets에 저장 → AI 패치 요약 프롬프트에 직접 활용
      language_scope: "all",
      is_sale_period: false,
      sale_text: "",
      is_free_weekend: false,
    }, gameSheetId);

    // 재분석 트리거 (GitHub Actions)
    if (GITHUB_TOKEN) {
      await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          event_type: "reanalyze-game",
          client_payload: { appid: String(appid), event_id: newEventId, content: content ?? "" },
        }),
      });
    }

    return NextResponse.json({ ok: true, event_id: newEventId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/event
 * 기존 이벤트의 특정 필드(title_kr, event_type, date 등)를 수정합니다.
 *
 * Body: {
 *   appid: string,
 *   event_id: string,
 *   updates: Partial<TimelineRow>,
 *   password: string,
 *   trigger_reanalyze?: boolean   // true 이면 analyze.yml 재실행
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { appid, event_id, updates, password, trigger_reanalyze } = await req.json();

    if (!appid || !event_id || !updates || !password) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const [config, game] = await Promise.all([
      getConfig(),
      getGame(String(appid)),
    ]);
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const gameSheetId = game?.game_sheet_id;
    await updateTimelineEventField(String(appid), event_id, updates, gameSheetId);

    if (trigger_reanalyze && GITHUB_TOKEN) {
      await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/analyze.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ ref: "main" }),
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
