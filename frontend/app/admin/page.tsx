import AdminPanel from "@/components/admin/AdminPanel";
import { getAllGames } from "@/lib/sheets";

export const revalidate = 30;

export default async function AdminPage() {
  let allGames: Awaited<ReturnType<typeof getAllGames>> = [];
  try {
    allGames = await getAllGames();
  } catch {}

  return <AdminPanel allGames={allGames} />;
}
