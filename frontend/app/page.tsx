import { getHomeData } from "@/lib/queries";
import { getTexts } from "@/lib/texts";
import HomeClient from "@/components/HomeClient";

export const revalidate = 120;
export const maxDuration = 30; // 무료 요금제 기본 10초보다 여유 있게 (최대 60초까지 가능)

export default async function HomePage() {
  const [texts, data] = await Promise.all([
    getTexts(),
    getHomeData().catch(() => ({ cards: [], w4: null, month: null, highlights: [] })),
  ]);
  return <HomeClient texts={texts} data={data} />;
}
