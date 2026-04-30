import { NextRequest, NextResponse } from "next/server";
import { getAllGames } from "@/lib/sheets";

export interface MultiSearchResult {
  appid: string;
  name: string;
  thumbnail: string;
  type: string;
  early_access: boolean;
  alreadyRegistered: boolean;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ results: [] });

  try {
    // AppID 직접 입력 시 단건 처리
    const isAppId = /^\d+$/.test(q.trim());

    // Steam URL에서 AppID 추출
    const urlMatch = q.match(/store\.steampowered\.com\/app\/(\d+)/);
    const resolvedId = urlMatch ? urlMatch[1] : isAppId ? q.trim() : null;

    let rawItems: { id: number; name: string; type?: string; tiny_image?: string; early_access?: boolean }[] = [];

    if (resolvedId) {
      // AppID → storesearch로 단건
      rawItems = [{ id: Number(resolvedId), name: "", type: "app", early_access: false }];
    } else {
      // 이름 검색 → storesearch 최대 10건
      const res  = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=us&num_per_page=10`,
        { next: { revalidate: 0 } }
      );
      const data = await res.json();
      rawItems = (data?.items ?? []).filter(
        (item: { type?: string }) => !item.type || item.type === "app"
      );
    }

    // 이미 등록된 appid 집합
    const games        = await getAllGames();
    const registeredIds = new Set(
      games
        .filter((g) => g.status !== "archived")
        .map((g) => String(g.appid))
    );

    const results: MultiSearchResult[] = rawItems.slice(0, 10).map((item) => {
      const appid = String(item.id);
      return {
        appid,
        name:              item.name || appid,
        thumbnail:         `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
        type:              item.type ?? "app",
        early_access:      item.early_access ?? false,
        alreadyRegistered: registeredIds.has(appid),
      };
    });

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
