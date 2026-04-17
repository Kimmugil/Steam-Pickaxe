import { NextRequest, NextResponse } from "next/server";
import { getCcuData } from "@/lib/sheets";

export async function GET(_req: NextRequest, { params }: { params: { appid: string } }) {
  try {
    const data = await getCcuData(params.appid);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}
