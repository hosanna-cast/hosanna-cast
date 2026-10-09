import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChurchProvider } from "@/lib/church";
import { normalizeRole } from "@/lib/roles";

export default async function ControlLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: m } = await supabase
    .from("memberships")
    .select("role, churches(id, name, screen_token)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m?.churches) redirect("/onboarding");

  const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle();

  const { id, name, screen_token } = m.churches;
  return (
    <ChurchProvider value={{ id, name, token: screen_token, role: normalizeRole(m.role), email: user.email, firstName: profile?.first_name || "", lastName: profile?.last_name || "" }}>
      {children}
    </ChurchProvider>
  );
}
