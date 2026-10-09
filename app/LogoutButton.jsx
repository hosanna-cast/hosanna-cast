"use client";
import { createClient } from "@/lib/supabase/client";

// Bouton « Déconnexion » en haut à droite de la page d'accueil
export default function LogoutButton() {
  const logout = async () => {
    await createClient().auth.signOut();
    location.href = "/login";
  };
  return (
    <button
      onClick={logout}
      className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-lg bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-sm text-neutral-200 px-3 py-1.5 transition duration-100 active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
      </svg>
      Déconnexion
    </button>
  );
}
