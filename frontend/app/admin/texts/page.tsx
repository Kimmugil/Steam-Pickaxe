import Link from "next/link";
import { redirect } from "next/navigation";
import TextsClient from "@/components/TextsClient";
import { isAdmin } from "@/lib/auth";
import { getSavedKeys, getTexts } from "@/lib/texts";

export const dynamic = "force-dynamic";

export default async function TextsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [texts, saved] = await Promise.all([getTexts(), getSavedKeys()]);
  return (
    <div>
      <Link href="/admin" className="back">← 관리자 현황판</Link>
      <div className="sec-title" style={{ marginTop: 0 }}><h2>화면 문구 관리</h2><span>저장하면 바로 사이트에 반영됩니다. 동기화 버튼은 없습니다.</span></div>
      <TextsClient texts={texts} saved={saved} />
    </div>
  );
}
