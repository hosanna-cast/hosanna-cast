"use client";
import { useMemo, useState } from "react";
import { timeLeft, expiryDate } from "@/lib/expiry";
import { fold } from "@/lib/textUtil";

const small = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

// Carré « Playlists » : indépendant de la liste des chants (qui est dans son propre carré en dessous).
// Playlist effacée automatiquement après 3 jours.
export default function ChantPlaylists({ playlists, chants, selectedId, onPick }) {
  const { list, error, create, remove, setChants } = playlists;
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);    // choix multiple des chants de la playlist ouverte
  const [picked, setPicked] = useState([]);
  const [pq, setPq] = useState("");

  const open = list.find((p) => p.id === openId) || null;
  const byId = useMemo(() => new Map(chants.map((c) => [c.id, c])), [chants]);
  const ids = open?.chant_ids || [];
  const pos = ids.indexOf(selectedId);

  const sorted = useMemo(() => [...chants].sort((a, b) => a.title.localeCompare(b.title, "fr")), [chants]);
  const shown = useMemo(() => {
    const n = fold(pq.trim());
    return n ? sorted.filter((x) => fold([x.title, x.person].join(" ")).includes(n)) : sorted;
  }, [sorted, pq]);

  const toggleOpen = (id) => { setOpenId(openId === id ? null : id); setPicking(false); };
  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const id = await create(n);
    setBusy(false);
    if (id) { setOpenId(id); setName(""); setAdding(false); setPicking(false); }
  };
  const move = (i, d) => {
    const a = [...ids]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setChants(open.id, a);
  };
  const go = (d) => { const t = ids[pos + d]; if (t && byId.has(t)) onPick?.(t); };
  const startPick = () => { setPicked([...ids]); setPq(""); setPicking(true); };
  const tick = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const validate = () => { setChants(open.id, picked); setPicking(false); };

  return (
    <div className="mb-3 rounded-lg border border-neutral-700 bg-neutral-900/40 p-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium">Playlists</span>
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
          <p className="text-[11px] text-neutral-500 leading-4">Tu choisiras ensuite les chants à y mettre. La playlist s'efface automatiquement après 3 jours.</p>
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
                <button onClick={() => toggleOpen(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition duration-100 active:scale-[0.98] ${isOpen ? "bg-amber-400 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                  <span className="block text-sm font-medium truncate">{p.name}</span>
                  <span className={`block text-xs ${isOpen ? "text-black/60" : "text-neutral-500"}`}>
                    {p.chant_ids.length} chant{p.chant_ids.length > 1 ? "s" : ""} · s'efface dans {timeLeft(p.expires_at)}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-1 rounded-lg border border-amber-400/40 bg-neutral-900 p-2">
                    {picking ? (
                      /* ───── choix multiple des chants ───── */
                      <div>
                        <div className="text-xs text-neutral-400 mb-1.5">Coche les chants de « {open.name} »</div>
                        <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Chercher un chant"
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-amber-400 mb-1.5" />
                        {!chants.length ? (
                          <p className="text-xs text-neutral-500 px-1 py-2">Aucun chant pour l'instant. Ajoute d'abord des chants dans « Mes chants ».</p>
                        ) : !shown.length ? (
                          <p className="text-xs text-neutral-500 px-1 py-2">Aucun résultat.</p>
                        ) : (
                          <ul className="max-h-56 overflow-y-auto space-y-1">
                            {shown.map((c) => {
                              const on = picked.includes(c.id);
                              return (
                                <li key={c.id}>
                                  <label className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer transition duration-100 ${on ? "bg-amber-400/15 ring-1 ring-amber-400/50" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                                    <input type="checkbox" checked={on} onChange={() => tick(c.id)} className="h-4 w-4 accent-amber-400 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block text-sm truncate">{c.title}</span>
                                      {c.person && <span className="block text-xs text-neutral-500 truncate">{c.person}</span>}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                          <button onClick={() => setPicking(false)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-1.5 text-sm active:scale-95">Annuler</button>
                          <button onClick={validate} className="rounded-lg bg-amber-400 text-black font-medium py-1.5 text-sm active:scale-95">Valider ({picked.length})</button>
                        </div>
                      </div>
                    ) : (
                      /* ───── contenu de la playlist ───── */
                      <>
                        <button onClick={startPick}
                          className="w-full mb-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-1.5 text-xs font-medium transition duration-100 active:scale-95">
                          ＋ Ajouter des chants à la playlist
                        </button>
                        {ids.length > 0 && (
                          <div className="grid grid-cols-2 gap-1.5 mb-2">
                            <button className={small + " py-1.5"} disabled={pos <= 0} onClick={() => go(-1)}>‹ Chant préc.</button>
                            <button className={small + " py-1.5"} disabled={pos >= ids.length - 1} onClick={() => go(1)}>Chant suiv. ›</button>
                          </div>
                        )}
                        {ids.length === 0 ? (
                          <p className="text-xs text-neutral-400 leading-5 px-1">Playlist vide.</p>
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
                      </>
                    )}
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
