import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// La personne connectée choisit son nouveau mot de passe ; l'obligation de le changer est levée
export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);

  const b = await req.json().catch(() => ({}));
  const password = String(b.password || "");
  if (password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères.");

  const admin = createAdminClient();
  if (!admin) return fail("Clé « service » non reçue par ce déploiement (SUPABASE_SERVICE_ROLE_KEY).", 500);

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...(user.app_metadata || {}), must_change_password: false },
  });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
