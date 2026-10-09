"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Interrupteur « Aide » de l'administrateur : il choisit UNE personne (profil « Aide écran ») qui peut projeter à sa place.
export default function HelpControl({ helperId, peers, busy, onPick }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const box = useRef(null);

  const load = () => createClient().rpc("list_members").then(({ data }) => setList((data || []).filter((u) => u.role === "assistant")));
  useEffect(() => { load(); }, []);                               // pour afficher le nom de l'aide choisie
  useEffect(() => {
    if (!open) return;
    load();
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const name = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
  const online = (uid) => peers.some((p) => p.uid === uid);
  const on = !!helperId;
  const current = list?.find((u) => u.user_id === helperId);
  const pick = (uid) => { setOpen(false); onPick(uid); };

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border pl-2.5 pr-2 py-1 text-sm transition duration-100 active:scale-95 disabled:opacity-60 ${on ? "bg-sky-500/20 border-sky-400 text-sky-100" : "bg-neutral-800 border-neutral-600 hover:border-neutral-500 text-neutral-200"}`}>
        <span className="hidden sm:inline max-w-[9rem] truncate">{on ? `Aide : ${current ? current.first_name || name(current) : "…"}` : "Aide"}</span>
        <span className="sm:hidden">Aide</span>
        <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-sky-400" : "bg-neutral-600"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 max-w-[85vw] rounded-xl bg-neutral-800 border border-neutral-600 p-2 z-50 shadow-xl">
          <div className="px-2 pt-1 pb-2 border-b border-neutral-700 mb-1">
            <div className="text-sm font-medium">Autoriser l'aide</div>
            <div className="text-xs text-neutral-400">Choisissez qui peut projeter. Une seule personne à la fois.</div>
          </div>

          {!list ? <p className="px-2 py-2 text-sm text-neutral-500">Chargement…</p>
            : list.length === 0 ? (
              <p className="px-2 py-2 text-sm text-neutral-400">Aucun profil « Aide écran ». <a href="/admin" className="text-amber-400 hover:underline">Créez-en un dans Administration.</a></p>
            ) : (
              <ul>
                {list.map((u) => (
                  <li key={u.user_id}>
                    <button role="menuitem" onClick={() => pick(u.user_id)} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-neutral-700">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${online(u.user_id) ? "bg-green-400" : "bg-neutral-600"}`} title={online(u.user_id) ? "Connecté" : "Pas connecté"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm truncate">{name(u)}</span>
                        <span className="block text-xs text-neutral-500 truncate">{online(u.user_id) ? "Connecté" : "Pas connecté"}</span>
                      </span>
                      {u.user_id === helperId && <span className="text-xs text-sky-300">Autorisé ✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}

          {on && (
            <button role="menuitem" onClick={() => pick(null)} className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-red-300 hover:bg-neutral-700 border-t border-neutral-700">Arrêter l'aide</button>
          )}
        </div>
      )}
    </div>
  );
}
