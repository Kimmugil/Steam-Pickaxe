import { NextRequest, NextResponse } from "next/server";
import { getGame, getTimeline } from "@/lib/sheets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appid: string }> }) {
  try {
    const { appid } = await params;
    const [game, timeline] = await Promise.all([
      getGame(appid),
      getTimeline(appid),
    ]);
    if (!game) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ game, timeline });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
