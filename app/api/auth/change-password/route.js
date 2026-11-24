import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/server";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// La personne connectée choisit son nouveau mot de passe ; l'obligation de le changer est levée
export async function POST(req) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(t("api.loginRequired"), 401);

  const b = await req.json().catch(() => ({}));
  const password = String(b.password || "");
  if (password.length < 8) return fail(t("api.passwordShort"));

  const admin = createAdminClient();
  if (!admin) return fail(t("api.keyMissing"), 500);

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...(user.app_metadata || {}), must_change_password: false },
  });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
