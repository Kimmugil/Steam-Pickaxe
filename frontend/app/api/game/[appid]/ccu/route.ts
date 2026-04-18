import { NextRequest, NextResponse } from "next/server";
import { getCcuData, getGame } from "@/lib/sheets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appid: string }> }) {
  try {
    const { appid } = await params;
    const game = await getGame(appid);
    const data = await getCcuData(appid, game?.game_sheet_id);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
