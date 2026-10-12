import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_IDS, normalizeRole } from "@/lib/roles";

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// Vérifie que l'appelant est administrateur et retrouve la personne visée (de la même église)
async function guard(target) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: fail("Connexion requise.", 401) };
  const { data: m } = await supabase.from("memberships").select("church_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!m || normalizeRole(m.role) !== "admin") return { err: fail("Réservé aux administrateurs.", 403) };
  if (!target) return { err: fail("Profil manquant.") };
  const admin = createAdminClient();
  if (!admin) return { err: fail("Clé « service » non reçue par ce déploiement (SUPABASE_SERVICE_ROLE_KEY).", 500) };
  const { data: t } = await admin.from("memberships").select("role").eq("user_id", target).eq("church_id", m.church_id).maybeSingle();
  if (!t) return { err: fail("Ce profil n'appartient pas à votre église.", 404) };
  return { user, m, admin, targetRole: normalizeRole(t.role) };
}

// Il doit toujours rester au moins un administrateur
async function lastAdmin(admin, churchId) {
  const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true })
    .eq("church_id", churchId).in("role", ["owner", "admin"]);
  return (count ?? 0) <= 1;
}

// Modifier un profil : prénom, nom, email, profil (rôle) et, si renseigné, nouveau mot de passe provisoire
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const g = await guard(b.userId);
  if (g.err) return g.err;
  const { user, m, admin, targetRole } = g;

  const first = String(b.first || "").trim();
  const last = String(b.last || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = b.role;
  if (!first) return fail("Le prénom est obligatoire.");
  if (!email.includes("@")) return fail("Email invalide.");
  if (password && password.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères.");
  if (!ROLE_IDS.includes(role)) return fail("Profil inconnu.");
  if (targetRole === "admin" && role !== "admin" && (await lastAdmin(admin, m.church_id)))
    return fail("Il faut garder au moins un administrateur.");

  // compte (email, mot de passe)
  const { data: cur, error: e0 } = await admin.auth.admin.getUserById(b.userId);
  if (e0 || !cur?.user) return fail("Compte introuvable.", 404);
  const attrs = {};
  if (email !== (cur.user.email || "").toLowerCase()) { attrs.email = email; attrs.email_confirm = true; }
  if (password) {
    attrs.password = password;
    // mot de passe provisoire : la personne devra le changer à sa prochaine connexion (sauf si c'est soi-même)
    if (b.userId !== user.id) attrs.app_metadata = { ...(cur.user.app_metadata || {}), must_change_password: true };
  }
  if (Object.keys(attrs).length) {
    const { error } = await admin.auth.admin.updateUserById(b.userId, attrs);
    if (error) return fail(/already|registered|exists/i.test(error.message) ? "Cet email a déjà un compte." : error.message);
  }

  // profil (rôle) et nom
  const { error: e1 } = await admin.from("memberships").update({ role }).eq("user_id", b.userId).eq("church_id", m.church_id);
  if (e1) return fail(e1.message, 500);
  const { data: upd } = await admin.from("profiles").update({ first_name: first, last_name: last }).eq("user_id", b.userId).select("user_id");
  if (!upd?.length) await admin.from("profiles").insert({ user_id: b.userId, first_name: first, last_name: last });

  return NextResponse.json({ ok: true });
}

// Supprimer un profil : le compte est supprimé définitivement
export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  const g = await guard(b.userId);
  if (g.err) return g.err;
  const { user, m, admin, targetRole } = g;

  if (b.userId === user.id) return fail("Vous ne pouvez pas supprimer votre propre profil.");
  if (targetRole === "admin" && (await lastAdmin(admin, m.church_id))) return fail("Il faut garder au moins un administrateur.");

  const { error: e1 } = await admin.from("memberships").delete().eq("user_id", b.userId).eq("church_id", m.church_id);
  if (e1) return fail(e1.message, 500);
  await admin.from("profiles").delete().eq("user_id", b.userId);
  const { error: e2 } = await admin.auth.admin.deleteUser(b.userId);
  if (e2) return fail(`Retiré de l'équipe, mais le compte n'a pas pu être supprimé : ${e2.message}`, 500);

  return NextResponse.json({ ok: true });
}
