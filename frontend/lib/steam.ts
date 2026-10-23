/** Steam 상점 조회 (서버에서만). 이름 검색, 게임 정보. */
export interface SteamHit { appid: number; name: string; meta: string; image: string | null }

const UA = { "User-Agent": "steam-pickaxe/2.0 (personal research tracker)" };

export function parseAppId(input: string): number | null {
  const m = input.match(/\/app\/(\d+)/) ?? input.match(/^\s*(\d{3,9})\s*$/);
  return m ? Number(m[1]) : null;
}

export interface AppDetails {
  name: string; thumbnail: string | null; release_date_text: string | null; release_date: string | null;
  genres: string[]; developer: string | null; publisher: string | null; is_free: boolean; is_early_access: boolean;
  price: string | null; price_final: number | null; discount_percent: number;
}

function parseRelease(t: string | null | undefined): string | null {
  if (!t) return null;
  const d = new Date(t + " UTC");
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = t.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

export async function appDetails(appid: number): Promise<AppDetails | null> {
  try {
    const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    const node = j?.[String(appid)];
    if (!node?.success) return null;
    const x = node.data ?? {};
    const po = x.price_overview ?? {};
    const genres = (x.genres ?? []) as { id: string; description: string }[];
    const rel = x.release_date?.date ?? null;
    return {
      name: x.name, thumbnail: x.header_image ?? null, release_date_text: rel, release_date: parseRelease(rel),
      genres: genres.map((g) => g.description), developer: (x.developers ?? []).join(", ") || null, publisher: (x.publishers ?? []).join(", ") || null,
      is_free: !!x.is_free, is_early_access: genres.some((g) => String(g.id) === "70"), price: po.final_formatted ?? (x.is_free ? "Free" : null),
      price_final: po.final ?? null, discount_percent: po.discount_percent ?? 0,
    };
  } catch { return null; }
}

export async function steamSearch(term: string): Promise<SteamHit[]> {
  const id = parseAppId(term);
  if (id) {
    const d = await appDetails(id);
    return d ? [{ appid: id, name: d.name, meta: [d.release_date_text, d.developer].filter(Boolean).join(" · "), image: d.thumbnail }] : [];
  }
  try {
    const r = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    return ((j.items ?? []) as { id: number; name: string; tiny_image?: string; type?: string }[])
      .filter((i) => !i.type || i.type === "app")
      .slice(0, 8)
      .map((i) => ({ appid: i.id, name: i.name, meta: "Steam 상점", image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${i.id}/header.jpg` }));
  } catch { return []; }
}
