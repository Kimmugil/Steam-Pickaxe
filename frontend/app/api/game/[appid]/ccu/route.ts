import { NextRequest, NextResponse } from "next/server";
import { getCcuData } from "@/lib/sheets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appid: string }> }) {
  try {
    const { appid } = await params;
    const data = await getCcuData(appid);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
