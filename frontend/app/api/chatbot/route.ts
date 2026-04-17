import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getConfig, setConfigValue, getTimeline, getGame } from "@/lib/sheets";
import type { Game, TimelineRow } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { appid, question, history = [] } = await req.json();
    if (!appid || !question) {
      return NextResponse.json({ error: "appid and question required" }, { status: 400 });
    }

    // 일일 한도 확인
    const config = await getConfig();
    const limit = parseInt(config.chatbot_daily_limit ?? "200");
    const count = parseInt(config.chatbot_today_count ?? "0");
    if (count >= limit) {
      return NextResponse.json({ limitReached: true });
    }

    // 게임 데이터 컨텍스트 구성
    const [game, timelineRows] = await Promise.all([
      getGame(String(appid)),
      getTimeline(String(appid)),
    ]);

    if (!game) return NextResponse.json({ error: "game not found" }, { status: 404 });

    const allRows = timelineRows.filter((r) => r.language_scope === "all");
    const context = buildContext(game, allRows);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `당신은 Steam 게임 분석 어시스턴트입니다.
제공된 데이터를 기반으로 현상 진단 및 인과관계 분석만 수행하세요.
규칙:
- 지시적/주관적 어조 배제 ('권장합니다', '해야 합니다' 등 금지)
- 데이터에 없는 수치, 날짜, URL 생성 금지
- SteamSpy 추정 지표 언급 시 '추정치' 명시
- 간결하고 명확하게 답변 (200자 이내 권장)
- 한국어로 답변

게임 데이터:
${context}`,
    });

    const chat = model.startChat({
      history: history.map((m: { role: string; text: string }) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
    });

    const result = await chat.sendMessage(question);
    const answer = result.response.text();

    // 호출 카운터 증가
    await setConfigValue("chatbot_today_count", String(count + 1));

    return NextResponse.json({ answer });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function buildContext(game: Game, rows: TimelineRow[]): string {
  const parts: string[] = [
    `게임명: ${game.name_kr || game.name}`,
    `총 리뷰: ${game.totalReviews}건`,
    `추정 소유자: ${game.owners_estimate}명 (추정치)`,
    `최근 2주 활성 플레이어: ${game.active_players_2weeks}명 (추정치)`,
    `AI 현황 진단: ${game.ai_briefing}`,
    "",
    "=== 업데이트 히스토리 ===",
  ];

  for (const r of rows.slice(-15)) {
    parts.push(
      `[${r.date}] ${r.title} | 긍정률: ${r.sentiment_rate}% | 리뷰: ${r.review_count}건\n` +
      `  반응: ${String(r.ai_reaction_summary ?? "").slice(0, 200)}`
    );
  }

  return parts.join("\n");
}
