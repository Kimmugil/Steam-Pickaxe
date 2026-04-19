import AdminPanel from "@/components/admin/AdminPanel";
import { getAllGames } from "@/lib/sheets";

export const revalidate = 30;

export default async function AdminPage() {
  let games: Awaited<ReturnType<typeof getAllGames>> = [];
  try {
    games = await getAllGames();
  } catch {}

  const collectingGames = games.filter(
    (g) => g.status === "collecting" || g.status === "error_pool_empty"
  );

  return <AdminPanel collectingGames={collectingGames} />;
}
