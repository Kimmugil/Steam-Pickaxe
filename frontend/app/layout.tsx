import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "스팀 탈곡기 Pro",
  description: "Steam 게임 마켓 인텔리전스 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg-primary text-text-primary">
        <Navbar />
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
