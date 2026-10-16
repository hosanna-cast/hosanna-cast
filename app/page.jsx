import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import { normalizeRole } from "@/lib/roles";

// `roles` : profils qui voient la carte. `row` : "top" = grande rangée en haut (pleine largeur), "bottom" = rangée du dessous.
const cards = [
  { href: "/control", title: "Console", desc: "Bible, notes et chants : pilotez la projection (connexion requise).", row: "top", roles: ["admin", "assistant"] },
  { href: "/admin", title: "Administration", desc: "Équipe, profils et invitations.", row: "top", roles: ["admin"] },
  { href: "/control?tab=notes", title: "Notes", desc: "Ouvrir vos notes de prédication (.docx).", row: "bottom", roles: ["admin", "assistant"] },
  { href: "/control?tab=chants", title: "Chants", desc: "Parcourir et projeter les paroles de chants.", row: "bottom", roles: ["admin", "assistant", "standard"] },
  { href: "/control?tab=annonces", title: "Annonces", desc: "Photos et vidéos à projeter : régulières, temps spéciaux, ponctuelles.", row: "bottom", roles: ["admin", "assistant", "annonces"] },
];
const COLS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

export default async function Home() {
  // utilisateur connecté ? (la page reste utilisable si Supabase ne répond pas)
  let name = "";
  let logged = false;
  let role = "standard";
  let mustChange = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      logged = true;
      mustChange = !!user.app_metadata?.must_change_password;
      const [{ data: m }, { data: profile }] = await Promise.all([
        supabase.from("memberships").select("role").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("profiles").select("first_name").eq("user_id", user.id).maybeSingle(),
      ]);
      role = normalizeRole(m?.role);
      name = profile?.first_name || user.email?.split("@")[0] || "";
    }
  } catch {}

  // pas connecté : la page d'accueil, c'est la connexion
  if (!logged) redirect("/login");
  if (mustChange) redirect("/change-password");      // première connexion : mot de passe à changer

  // chacun ne voit que ce qui lui est ouvert (profil « Chants » : chants seulement)
  const list = cards.filter((c) => !c.roles || c.roles.includes(role));

  return (
    <main className="relative min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
      <LogoutButton />
      <img src="/logo.png" alt="" width={96} height={96} className="h-20 w-20 sm:h-24 sm:w-24 mb-4" />
      <h1 className="text-3xl sm:text-4xl font-semibold mb-2">
        Hosanna <span className="text-amber-400">Cast</span>
      </h1>
      <p className="text-neutral-400 mb-6 text-center">Projection de versets, notes et chants.</p>

      <p className="mb-5 text-center text-neutral-200">
        Bonjour <span className="text-amber-400 font-medium">{name}</span>, bienvenue sur ton espace
      </p>

      <div className="w-full max-w-5xl space-y-4">
        {["top", "bottom"].map((row) => {
          const items = list.filter((c) => c.row === row);
          if (!items.length) return null;
          return (
            <div key={row} className={`grid gap-4 grid-cols-1 ${COLS[items.length]}`}>
              {items.map((c) => (
                <Link key={c.href} href={c.href}
                  className="rounded-xl p-5 border bg-neutral-800 border-neutral-700 hover:bg-neutral-700 transition duration-100 active:scale-95">
                  <div className="text-lg text-amber-400 font-semibold">{c.title}</div>
                  <div className="text-sm mt-1 text-white/90">{c.desc}</div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}
