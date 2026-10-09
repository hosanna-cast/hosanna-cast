import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import { normalizeRole } from "@/lib/roles";

const cards = [
  { href: "/control", title: "Console", desc: "Bible, notes et chants : pilotez la projection (connexion requise).", accent: true },
  { href: "/control?tab=notes", title: "Notes", desc: "Ouvrir vos notes de prédication (.docx)." },
  { href: "/control?tab=chants", title: "Chants", desc: "Parcourir et projeter les paroles de chants." },
  { href: "/admin", title: "Administration", desc: "Équipe, profils et invitations.", only: ["admin"] },
  { href: "/login", title: "Connexion", desc: "Se connecter ou inscrire votre église." },
];

export default async function Home() {
  // utilisateur connecté ? (la page reste utilisable si Supabase ne répond pas)
  let name = "";
  let logged = false;
  let role = "standard";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      logged = true;
      const { data: m } = await supabase.from("memberships").select("role").eq("user_id", user.id).limit(1).maybeSingle();
      role = normalizeRole(m?.role);
      const { data: profile } = await supabase.from("profiles").select("first_name").eq("user_id", user.id).maybeSingle();
      name = profile?.first_name || user.email?.split("@")[0] || "";
    }
  } catch {}

  // connecté : plus de bouton « Connexion »
  // et chacun ne voit que ce qui lui est ouvert (profil « Chants » : chants seulement)
  const list = (logged ? cards.filter((c) => c.href !== "/login") : cards.filter((c) => !c.only))
    .filter((c) => !c.only || c.only.includes(role))
    .filter((c) => !(logged && role === "standard" && ["Console", "Notes"].includes(c.title)));

  return (
    <main className="relative min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
      {logged && <LogoutButton />}
      <img src="/logo.png" alt="" width={96} height={96} className="h-20 w-20 sm:h-24 sm:w-24 mb-4" />
      <h1 className="text-3xl sm:text-4xl font-semibold mb-2">
        Hosanna <span className="text-amber-400">Cast</span>
      </h1>
      <p className="text-neutral-400 mb-6 text-center">Projection de versets, notes et chants.</p>

      {logged && (
        <p className="mb-5 text-center text-neutral-200">
          Bonjour <span className="text-amber-400 font-medium">{name}</span>, bienvenue sur ton espace
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
        {list.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            target={c.external ? "_blank" : undefined}
            className={`rounded-xl p-5 border transition duration-100 active:scale-95 ${
              c.accent
                ? "bg-amber-400 text-black border-amber-400 hover:bg-amber-300"
                : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
            }`}
          >
            <div className="text-lg font-semibold">{c.title}</div>
            <div className={`text-sm mt-1 ${c.accent ? "text-black/70" : "text-neutral-400"}`}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
