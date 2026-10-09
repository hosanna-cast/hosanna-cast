import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_IDS, normalizeRole } from "@/lib/roles";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// L'administrateur crée directement le compte d'un membre (email + mot de passe provisoire + profil)
export async function POST(req) {
  // 1) l'appelant doit être un administrateur connecté
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);
  const { data: m } = await supabase.from("memberships").select("church_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!m || normalizeRole(m.role) !== "admin") return fail("Réservé aux administrateurs.", 403);

  // 2) données saisies
  const b = await req.json().catch(() => ({}));
  const first = String(b.first || "").trim();
  const last = String(b.last || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = b.role;
  if (!first || !email.includes("@")) return fail("Prénom et email obligatoires.");
  if (password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères.");
  if (!ROLE_IDS.includes(role)) return fail("Profil inconnu.");

  // 3) création du compte (clé « service » à ajouter dans Vercel)
  const admin = createAdminClient();
  if (!admin) return fail("Clé manquante : ajoutez SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement de Vercel, puis redéployez.", 500);

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return fail(/already|registered|exists/i.test(error.message) ? "Cet email a déjà un compte." : error.message);
  const uid = data.user.id;

  const { error: e2 } = await admin.from("memberships").insert({ user_id: uid, church_id: m.church_id, role });
  if (e2) { await admin.auth.admin.deleteUser(uid); return fail(e2.message, 500); }

  const { data: upd } = await admin.from("profiles").update({ first_name: first, last_name: last }).eq("user_id", uid).select("user_id");
  if (!upd?.length) await admin.from("profiles").insert({ user_id: uid, first_name: first, last_name: last });

  return NextResponse.json({ ok: true });
}
