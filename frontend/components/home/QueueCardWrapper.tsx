"use client";
import { useRouter } from "next/navigation";
import QueueCard from "@/components/home/QueueCard";
import type { Game } from "@/types";

export default function QueueCardWrapper({ game }: { game: Game }) {
  const router = useRouter();
  return (
    <QueueCard
      game={game}
      onCancelled={() => router.refresh()}
    />
  );
}
