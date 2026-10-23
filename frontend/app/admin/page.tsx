import { redirect } from "next/navigation";
import AdminClient from "@/components/AdminClient";
import { isAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 무료 요금제 기본 10초보다 여유 있게 (최대 60초까지 가능)

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const data = await getAdminData();
  return <AdminClient data={data} githubConnected={!!(process.env.GH_PAT ?? process.env.GITHUB_TOKEN)} />;
}
