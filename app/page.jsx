import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Page d'accueil : personne n'a besoin de la vue orateur ici.
// Connecté → console (/control) ; chaque rôle y voit ses onglets (voir lib/roles.js).
// Pas connecté → /login.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/control" : "/login");
}
