import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { UiTextProvider } from "@/contexts/UiTextContext";
import { getUiText } from "@/lib/sheets";

export const metadata: Metadata = {
  title: "스팀 탈곡기 Pro",
  description: "Steam 게임 마켓 인텔리전스 대시보드",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버에서 Sheets ui_text 탭을 조회 (unstable_cache로 60초 TTL 캐싱).
  // 같은 TTL 내 중복 호출은 캐시에서 즉시 반환되므로 API 과금 없음.
  // 실패 시 빈 객체 → Context 내부 FALLBACK 텍스트가 자동 적용됨.
  const uiText = await getUiText();

  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg-primary text-text-primary">
        {/*
          UiTextProvider는 Client Component.
          서버에서 조회한 uiText를 initialText로 주입해
          클라이언트 추가 fetch 없이 SSR 시점에 텍스트 완전 제공.
        */}
        <UiTextProvider initialText={uiText}>
          <Navbar />
          <main className="pt-14">{children}</main>
        </UiTextProvider>
      </body>
    </html>
  );
}
