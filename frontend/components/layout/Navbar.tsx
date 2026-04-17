"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiText } from "@/contexts/UiTextContext";

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useUiText();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-secondary border-b border-border-default flex items-center px-6">
      <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-accent-blue text-xl font-bold tracking-tight group-hover:text-blue-400 transition-colors">
            {t("NAV_BRAND")}
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/guide"
            className={`text-sm transition-colors ${
              pathname === "/guide"
                ? "text-accent-blue"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t("NAV_GUIDE")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
