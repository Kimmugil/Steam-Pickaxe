import { NextRequest, NextResponse } from "next/server";
import { getConfig, batchUpdateSortOrders } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { password, orders } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    if (!Array.isArray(orders) || orders.length === 0)
      return NextResponse.json({ error: "orders가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    await batchUpdateSortOrders(orders);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
