import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getTexts } from "@/lib/texts";

export const metadata: Metadata = {
  title: "Steam Pickaxe",
  description: "추적 중인 Steam 게임의 평가와 접속 흐름, 달라진 점을 한눈에 봅니다.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await getTexts();
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <div className="wrap">
          <div className="appbar">
            <Link href="/" className="brand"><i /><span>{t.site_title}</span></Link>
            <nav className="appnav">
              <Link href="/">홈</Link>
            </nav>
            {/* 로그인 여부를 읽지 않아야 공개 화면을 미리 만들어 두고(캐시) 빠르게 보여 줄 수 있습니다 */}
            <div className="right"><Link href="/admin" className="muted">관리자</Link></div>
          </div>
          {children}
          <div className="appfoot">{t.foot}</div>
        </div>
      </body>
    </html>
  );
}
