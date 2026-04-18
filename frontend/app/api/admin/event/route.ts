import { NextRequest, NextResponse } from "next/server";
import { getConfig, appendTimelineRow, deleteTimelineRowsByEventId, getTimeline, getGame } from "@/lib/sheets";
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
      language_scope: "all",
      is_sale_period: false,
      sale_text: "",
      is_free_weekend: false,
      // content는 AI 재분석 시 활용되도록 client_payload로 전달
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
