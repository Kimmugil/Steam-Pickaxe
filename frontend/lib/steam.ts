export async function searchSteamGame(query: string) {
  const isAppId = /^\d+$/.test(query.trim());

  if (isAppId) {
    return await fetchByAppId(query.trim());
  } else {
    return await fetchByName(query.trim());
  }
}

async function fetchByAppId(appid: string) {
  const res = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`
  );
  const data = await res.json();
  const info = data?.[appid];
  if (!info?.success) return null;
  const d = info.data;
  return {
    appid,
    name: d.name,
    thumbnail: d.header_image,
    type: d.type,
    totalReviews: 0,
    positiveRate: 0,
  };
}

async function fetchByName(name: string) {
  const res = await fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=us`
  );
  const data = await res.json();
  const item = data?.items?.[0];
  if (!item) return null;

  const appid = String(item.id);
  const detail = await fetchByAppId(appid);
  return detail ?? {
    appid,
    name: item.name,
    thumbnail: item.tiny_image,
    type: "unknown",
  };
}

export async function getSteamReviewSummary(appid: string) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all&num_per_page=0`
    );
    const data = await res.json();
    const qs = data?.query_summary;
    if (!qs) return { total: 0, positive: 0, rate: 0 };
    const total = qs.total_reviews ?? 0;
    const positive = qs.total_positive ?? 0;
    const rate = total > 0 ? Math.round((positive / total) * 100) : 0;
    return { total, positive, rate };
  } catch {
    return { total: 0, positive: 0, rate: 0 };
  }
}
