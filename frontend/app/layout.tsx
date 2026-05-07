import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import GlobalSyncButton from "@/components/layout/GlobalSyncButton";
import { UiTextProvider } from "@/contexts/UiTextContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { getUiText, getCachedConfig } from "@/lib/sheets";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getCachedConfig();
  const title = config.site_title || "스팀 탈곡기 Pro";
  const description = config.site_description || "Steam 게임 마켓 인텔리전스 대시보드";
  const ogImage = config.og_image || undefined;
  const siteUrl = config.site_url || "https://steam-pickaxe.vercel.app";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: title,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      locale: "ko_KR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uiText = await getUiText();

  return (
    <html lang="ko">
      <head>
        {/* 테마 플래시 방지: 페이지 로드 직후 data-theme 즉시 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg-primary text-text-primary">
        <UiTextProvider initialText={uiText}>
          <ThemeProvider>
            <Navbar />
            <main className="pt-14">{children}</main>
            <GlobalSyncButton />
          </ThemeProvider>
        </UiTextProvider>
      </body>
    </html>
  );
}
