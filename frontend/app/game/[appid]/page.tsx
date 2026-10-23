import { notFound } from "next/navigation";
import { getGameData } from "@/lib/queries";
import { getTexts } from "@/lib/texts";
import GameClient from "@/components/GameClient";

export const revalidate = 300;
export const maxDuration = 30; // 무료 요금제 기본 10초보다 여유 있게 (최대 60초까지 가능)
export const dynamicParams = true;

// 미리 만들어 두는 게임 화면은 없고, 처음 열릴 때 만들어 5분간 캐시합니다.
export async function generateStaticParams() {
  return [];
}

export default async function GamePage({ params }: { params: Promise<{ appid: string }> }) {
  const { appid } = await params;
  const id = Number(appid);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [texts, data] = await Promise.all([getTexts(), getGameData(id)]);
  if (!data) notFound();
  return <GameClient texts={texts} data={data} />;
}
