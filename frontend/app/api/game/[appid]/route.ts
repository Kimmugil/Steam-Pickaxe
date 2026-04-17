import { NextRequest, NextResponse } from "next/server";
import { getGame, getTimeline } from "@/lib/sheets";

export async function GET(_req: NextRequest, { params }: { params: { appid: string } }) {
  try {
    const [game, timeline] = await Promise.all([
      getGame(params.appid),
      getTimeline(params.appid),
    ]);
    if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ game, timeline });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
