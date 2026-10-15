"use client";
import { useState } from "react";
import { timeLeft, expiryDate } from "@/lib/expiry";

const small = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

// Playlists de chants (au-dessus de « Chercher un chant »). Effacées automatiquement après 3 jours.
// Une playlist ouverte (openId) : la liste « Mes chants » en dessous affiche un bouton ＋ pour y ajouter des chants.
export default function ChantPlaylists({ playlists, chants, openId, setOpenId, selectedId, onPick }) {
  const { list, error, create, remove, setChants } = playlists;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const open = list.find((p) => p.id === openId) || null;
  const byId = new Map(chants.map((c) => [c.id, c]));
  const ids = open?.chant_ids || [];
  const pos = ids.indexOf(selectedId);

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const id = await create(n);
    setBusy(false);
    if (id) { setOpenId(id); setName(""); setAdding(false); }
  };
  const move = (i, d) => {
    const a = [...ids]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setChants(open.id, a);
  };
  const go = (d) => { const t = ids[pos + d]; if (t && byId.has(t)) onPick?.(t); };

  return (
    <div className="mb-3 pb-3 border-b border-neutral-700">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-neutral-400 font-medium">Playlists</span>
        <span className="text-[11px] text-neutral-500">effacées après 3 jours</span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          Playlists indisponibles : {error}<br />
          <span className="text-red-300/70">Exécute le fichier <b>supabase/temporaire.sql</b> dans Supabase (SQL Editor).</span>
        </p>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} disabled={!!error}
          className="w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-sm font-medium transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
          + Ajouter une playlist
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-1.5">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la playlist (ex. Culte de dimanche)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-amber-400" />
          <p className="text-[11px] text-neutral-500 leading-4">Ensuite, appuie sur ＋ à côté des chants pour les ajouter. La playlist s'efface automatiquement après 3 jours.</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => { setAdding(false); setName(""); }} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-1.5 text-sm active:scale-95">Annuler</button>
            <button disabled={!name.trim() || busy} className="rounded-lg bg-amber-400 text-black font-medium py-1.5 text-sm active:scale-95 disabled:opacity-50">{busy ? "…" : "Créer"}</button>
          </div>
        </form>
      )}

      {list.length > 0 && (
        <ul className="mt-2 space-y-1">
          {list.map((p) => {
            const isOpen = p.id === openId;
            return (
              <li key={p.id}>
                <button onClick={() => setOpenId(isOpen ? null : p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition duration-100 active:scale-[0.98] ${isOpen ? "bg-amber-400 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                  <span className="block text-sm font-medium truncate">{p.name}</span>
                  <span className={`block text-xs ${isOpen ? "text-black/60" : "text-neutral-500"}`}>
                    {p.chant_ids.length} chant{p.chant_ids.length > 1 ? "s" : ""} · s'efface dans {timeLeft(p.expires_at)}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-1 rounded-lg border border-amber-400/40 bg-neutral-900 p-2">
                    {ids.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        <button className={small + " py-1.5"} disabled={pos <= 0} onClick={() => go(-1)}>‹ Chant préc.</button>
                        <button className={small + " py-1.5"} disabled={pos >= ids.length - 1} onClick={() => go(1)}>Chant suiv. ›</button>
                      </div>
                    )}
                    {ids.length === 0 ? (
                      <p className="text-xs text-neutral-400 leading-5 px-1">Playlist vide. Appuie sur <b className="text-amber-400">＋</b> à côté d'un chant ci-dessous pour l'ajouter.</p>
                    ) : (
                      <ol className="space-y-1">
                        {ids.map((id, i) => {
                          const c = byId.get(id);
                          return (
                            <li key={id + i} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${selectedId === id ? "bg-amber-400 text-black" : "bg-neutral-800"}`}>
                              <button disabled={!c} onClick={() => onPick?.(id)} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:cursor-default">
                                <span className={`text-xs w-4 text-center ${selectedId === id ? "text-black/60" : "text-neutral-500"}`}>{i + 1}</span>
                                <span className={`truncate ${c ? "" : "italic text-neutral-500"}`}>{c ? c.title : "(chant supprimé)"}</span>
                              </button>
                              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter" className="px-1 text-xs disabled:opacity-20">↑</button>
                              <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label="Descendre" className="px-1 text-xs disabled:opacity-20">↓</button>
                              <button onClick={() => setChants(open.id, ids.filter((_, k) => k !== i))} aria-label="Retirer de la playlist" className="px-1 text-xs hover:text-red-500">✕</button>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-[11px] text-neutral-500">Effacée le {expiryDate(open.expires_at)}</span>
                      <button onClick={() => { if (window.confirm(`Supprimer la playlist « ${open.name} » ?`)) { remove(open.id); setOpenId(null); } }}
                        className="text-xs text-neutral-500 hover:text-red-400">Supprimer</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
