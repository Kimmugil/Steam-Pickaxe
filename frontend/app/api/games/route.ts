import { NextResponse } from "next/server";
import { getAllGames } from "@/lib/sheets";

export async function GET() {
  try {
    const games = await getAllGames();
    return NextResponse.json(games);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
