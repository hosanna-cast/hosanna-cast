import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import AdminPanel from "./AdminPanel";

// Espace Administration : réservé aux administrateurs (les autres sont renvoyés à la console)
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: m } = await supabase
    .from("memberships").select("role, churches(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!m?.churches) redirect("/onboarding");
  if (!isAdmin(m.role)) redirect("/control");

  return <AdminPanel churchName={m.churches.name} />;
}
