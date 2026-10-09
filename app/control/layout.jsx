import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChurchProvider } from "@/lib/church";
import { normalizeRole } from "@/lib/roles";

export default async function ControlLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // les deux requêtes partent en même temps (au lieu de l'une après l'autre)
  const [{ data: m }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("role, churches(id, name, screen_token)").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!m?.churches) redirect("/onboarding");

  const { id, name, screen_token } = m.churches;
  return (
    <ChurchProvider value={{ id, name, token: screen_token, role: normalizeRole(m.role), email: user.email, userId: user.id, firstName: profile?.first_name || "", lastName: profile?.last_name || "" }}>
      {children}
    </ChurchProvider>
  );
}
