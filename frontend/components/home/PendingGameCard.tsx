"use client";
import Image from "next/image";
import type { Game } from "@/types";

export default function PendingGameCard({ game }: { game: Game }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
      {game.thumbnail && (
        <div className="relative w-full aspect-[460/215] bg-bg-secondary">
          <Image
            src={game.thumbnail}
            alt={game.name}
            fill
            className="object-cover opacity-40"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <span className="absolute top-2 left-2 text-[10px] bg-bg-secondary/90 text-text-muted px-2 py-0.5 rounded font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-pulse" />
            분석 준비 중
          </span>
        </div>
      )}
      <div className="p-4">
        <p className="font-semibold text-sm truncate text-text-primary">{game.name_kr || game.name}</p>
        {game.name_kr && game.name_kr !== game.name && (
          <p className="text-xs text-text-muted truncate mt-0.5">{game.name}</p>
        )}
        <p className="text-xs text-text-muted mt-3">데이터 수집 중...</p>
      </div>
    </div>
  );
}
