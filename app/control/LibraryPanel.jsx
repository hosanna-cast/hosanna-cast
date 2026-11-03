"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitSlides } from "@/lib/library";
import { findRefs } from "@/lib/refs";
import { readTextFile, readNoteFile } from "@/lib/readFile";
import { fold } from "@/lib/textUtil";
import { parseRef } from "@/lib/parseRef";
import ChantPlaylists from "./ChantPlaylists";
import Cutter, { linesFromSlides, slidesFromLines } from "./Cutter";

const COPY = {
  notes: { list: "Mes notes", search: "Chercher une note", empty: "Aucune note pour l'instant.", person: "Orateur (facultatif)", add: "Ajouter une note", paste: "Ou colle le texte de la prédication ici…" },
  chants: { list: "Mes chants", search: "Chercher un chant", empty: "Aucun chant pour l'instant.", person: "Auteur (facultatif)", add: "Ajouter un chant", paste: "Ou colle les paroles ici. Laisse une ligne vide entre les couplets…" },
};
const field = "w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-amber-400";

export default function LibraryPanel({ kind, items, ready, onAdd, onRemove, onUpdate, onPick, selectedId, bible, refOf, textOf, isLiveVerse, liveSlide, pausedSlide, onSlide, onVerse, playlists, onKeyPhrase, onOpen, hideKeys, canAnalyze }) {
  const t = COPY[kind];
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ title: "", person: "", session: "", text: "", manual: false, keys: [] });
  const [showText, setShowText] = useState(false);   // notes : le texte complet est caché, on ne montre que versets et points clés
  const openIdRef = useRef(null);
  const [ana, setAna] = useState(null);                // analyse IA : { status, msg, points, sel }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cutLines, setCutLines] = useState(null);         // découpage des paroles à l'ajout (chants)
  const [vq, setVq] = useState("");                       // « aller au verset » (chants)

  const open = items.find((x) => x.id === openId) || null;
  useEffect(() => { openIdRef.current = openId; setShowText(false); setAna(null); }, [openId]);
  // la page sait quelle note est ouverte (le champ « Texte rapide » peut y garder des phrases clés)
  useEffect(() => { onOpen?.(openId); return () => onOpen?.(null); }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  const slides = useMemo(() => (open ? splitSlides(open.text) : []), [open]);
  const verses = useMemo(() => (open ? findRefs(open.text, bible) : []), [open, bible]);

  const vResults = useMemo(() => {
    const ref = bible && vq.trim() ? parseRef(vq) : null;
    if (!ref) return [];
    return ref.books.slice(0, 3).map((b) => {
      const c = ref.chapter ? ref.chapter - 1 : 0;
      const v = ref.verse ? ref.verse - 1 : 0;
      if (bible[b]?.[c]?.[v] === undefined) return null;
      return { b, c, v, vEnd: ref.verseEnd ? ref.verseEnd - 1 : null };
    }).filter(Boolean);
  }, [vq, bible]);

  const filtered = useMemo(() => {
    const n = fold(q.trim());
    return n ? items.filter((x) => fold([x.title, x.person, x.session].join(" ")).includes(n)) : items;
  }, [items, q]);

  const groups = useMemo(() => {
    if (kind !== "notes") return [["", [...filtered].sort((a, b) => a.title.localeCompare(b.title, "fr"))]];
    const m = new Map();
    for (const x of filtered) {
      const k = x.session || "Sans session";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return [...m.entries()];
  }, [filtered, kind]);

  // la diapositive projetée reste visible dans la liste
  useEffect(() => {
    if (liveSlide && open && liveSlide.id === open.id)
      document.getElementById(`s-${open.id}-${liveSlide.i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [liveSlide]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAdd = () => {
    setF({ title: "", person: "", session: kind === "notes" ? items[0]?.session || `Culte du ${new Date().toLocaleDateString("fr-FR")}` : "", text: "", manual: false, keys: [] });
    setCutLines(null);
    setError("");
    setAdding(true);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { text, keys } = kind === "notes" ? await readNoteFile(file) : { text: await readTextFile(file, kind), keys: [] };
      setF((cur) => ({ ...cur, text, keys, title: cur.title || file.name.replace(/\.[^.]+$/, "") }));
      setError("");
    } catch (err) {
      setError(err.message || "Impossible de lire ce fichier.");
    } finally { setBusy(false); }
  };

  const submit = () => {
    const text = f.text.trim();
    if (!text) { setError("Ajoute un texte ou choisis un fichier."); return; }
    const title = f.title.trim() || text.split("\n")[0].slice(0, 60);
    const id = onAdd({ title, person: f.person.trim(), session: kind === "notes" ? f.session.trim() : "", text, ...(kind === "notes" && f.keys?.length ? { keys: f.keys } : {}), ...(kind === "chants" ? { slides: splitSlides(text, f.manual ? Infinity : undefined) } : {}) });
    setAdding(false);
    if (kind === "chants") onPick?.(id); else setOpenId(id);
  };

  // analyse IA d'une note : propose des points clés, l'équipe coche ceux à garder
  const analyze = async () => {
    if (!open) return;
    const id = open.id;
    setAna({ status: "loading", points: [], sel: [] });
    try {
      const r = await fetch("/api/analyze-note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: open.text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "L'analyse a échoué.");
      const have = new Set((open.keys || []).map((k) => k.trim()));
      const points = d.points.filter((p) => !have.has(p));
      setAna((cur) => (cur && openIdRef.current === id ? { status: "ready", points, sel: points.map((_, i) => i) } : cur));
    } catch (e) {
      setAna((cur) => (cur && openIdRef.current === id ? { status: "error", msg: e.message || "L'analyse a échoué.", points: [], sel: [] } : cur));
    }
  };
  const keepAnalysis = () => {
    if (!open || !ana?.points) return;
    onUpdate(open.id, { keys: [...(open.keys || []), ...ana.sel.slice().sort((a, b) => a - b).map((i) => ana.points[i])] });
    setAna(null);
  };

  /* ───── formulaire d'ajout ───── */
  if (adding && cutLines) {
    return (
      <div>
        <div className="text-sm font-medium text-amber-400 mb-1">Choisir où couper</div>
        <p className="text-xs text-neutral-500 mb-3">Clique entre deux lignes pour couper ou retirer une coupure. Chaque bloc sera une diapositive.</p>
        <Cutter lines={cutLines} onToggle={(i) => setCutLines((cur) => cur.map((l, k) => (k === i ? { ...l, cut: !l.cut } : l)))} />
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button onClick={() => setCutLines(null)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-sm transition duration-100 active:scale-95">Retour</button>
          <button onClick={() => { setF((cur) => ({ ...cur, text: slidesFromLines(cutLines).join("\n\n"), manual: true })); setCutLines(null); }}
            className="rounded-lg bg-amber-400 text-black font-medium py-2 text-sm transition duration-100 active:scale-95">Valider</button>
        </div>
      </div>
    );
  }
  if (adding) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-1">{t.add}</div>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Titre" className={field} />
        <input value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder={t.person} className={field} />
        {kind === "notes" && (
          <>
            <input list="sessions" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} placeholder="Session (ex. Culte 9h)" className={field} />
            <datalist id="sessions">{[...new Set(items.map((x) => x.session).filter(Boolean))].map((s) => <option key={s} value={s} />)}</datalist>
          </>
        )}
        <label className="block border border-dashed border-neutral-600 rounded-lg px-3 py-3 text-center text-sm text-neutral-400 hover:bg-neutral-700/40 cursor-pointer transition duration-100 active:scale-[0.98]">
          {busy ? "Lecture du fichier…" : "Choisir un fichier .txt, .md ou .docx"}
          <input type="file" accept=".txt,.md,.docx" onChange={onFile} className="hidden" />
        </label>
        {kind === "notes" && f.keys?.length > 0 && <p className="text-xs text-sky-300">{f.keys.length} point{f.keys.length > 1 ? "s" : ""} clé{f.keys.length > 1 ? "s" : ""} repéré{f.keys.length > 1 ? "s" : ""} en gras : {f.keys.length > 1 ? "ils seront gardés" : "il sera gardé"} dans la note.</p>}
        <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={7} placeholder={t.paste} className={`${field} resize-y`} />
        {kind === "chants" && (
          <button disabled={!f.text.trim()} onClick={() => setCutLines(linesFromSlides(splitSlides(f.text, Infinity)))}
            className="w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
            ✂ Découper les paroles
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => setAdding(false)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-sm transition duration-100 active:scale-95">Annuler</button>
          <button onClick={submit} className="rounded-lg bg-amber-400 text-black font-medium py-2 text-sm transition duration-100 active:scale-95">Ajouter</button>
        </div>
      </div>
    );
  }

  /* ───── modification ───── */
  if (open && editing) {
    const save = () => {
      const text = f.text.trim();
      if (!text) { setError("Le texte ne peut pas être vide."); return; }
      onUpdate(open.id, { title: f.title.trim() || text.split("\n")[0].slice(0, 60), person: f.person.trim(), session: kind === "notes" ? f.session.trim() : "", text });
      setEditing(false);
    };
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium mb-1">Modifier</div>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Titre" className={field} />
        <input value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder={t.person} className={field} />
        {kind === "notes" && <input value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} placeholder="Session" className={field} />}
        <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={14} className={`${field} resize-y leading-relaxed`} />
        <p className="text-[11px] text-neutral-500">Une ligne vide (ou une ligne <span className="text-neutral-300">---</span>) = nouvelle diapositive.</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => { setEditing(false); setError(""); }} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-sm transition duration-100 active:scale-95">Annuler</button>
          <button onClick={save} className="rounded-lg bg-amber-400 text-black font-medium py-2 text-sm transition duration-100 active:scale-95">Enregistrer</button>
        </div>
      </div>
    );
  }

  /* ───── élément ouvert ───── */
  if (open) {
    const isChant = kind === "chants";
    const startEdit = () => { setF({ title: open.title, person: open.person || "", session: open.session || "", text: open.text }); setError(""); setEditing(true); };
    return (
      <div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <button onClick={() => { setOpenId(null); setVq(""); }} className="text-amber-400 hover:underline">‹ {t.list}</button>
          <span className="flex gap-3">
            <button onClick={startEdit} className="text-xs text-neutral-400 hover:text-amber-400">Modifier</button>
          <button onClick={() => { if (window.confirm(`Supprimer « ${open.title} » ?`)) { onRemove(open.id); setOpenId(null); } }} className="text-xs text-neutral-500 hover:text-red-400">Supprimer</button>
          </span>
        </div>
        <div className="font-medium leading-snug">{open.title}</div>
        <div className="text-xs text-neutral-500 mb-3">
          {[open.person, open.session].filter(Boolean).join(" · ") || "\u00a0"}
          {" · "}{isChant ? `${slides.length} diapositive${slides.length > 1 ? "s" : ""}` : `${(open.keys || []).length} point${(open.keys || []).length > 1 ? "s" : ""} clé${(open.keys || []).length > 1 ? "s" : ""}`}
        </div>

        {isChant && pausedSlide && pausedSlide.id === open.id && (
          <button onClick={() => onSlide(open, pausedSlide.i, slides)}
            className="w-full mb-3 rounded-lg bg-amber-400 text-black font-medium py-2 text-sm transition duration-100 active:scale-95">
            ↩ Reprendre le chant (couplet {pausedSlide.i + 1})
          </button>
        )}

        <div className="mb-3">
          <div className="text-xs text-neutral-500 mb-1.5">{isChant ? "Le chantre cite un verset ?" : "Versets de la note"}</div>
          {isChant && (
            <>
              <input value={vq} onChange={(e) => setVq(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && vResults[0]) { onVerse(vResults[0]); setVq(""); } }}
                placeholder={bible ? "ex. jn 3 16 puis Entrée" : "Chargement de la Bible…"} className={`${field} mb-1.5`} />
              {vResults.map((r, i) => (
                <button key={i} onClick={() => { onVerse(r); setVq(""); }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-lg bg-blue-400/10 hover:bg-blue-400/20 mb-1 text-sm transition duration-100 active:scale-[0.98]">
                  <b className="font-medium text-blue-300">{refOf(r)}</b>{" "}
                  <span className="text-neutral-400 line-clamp-1">{textOf(r)}</span>
                </button>
              ))}
            </>
          )}
          {!bible ? (
            !isChant && <p className="text-xs text-neutral-500">Chargement de la Bible…</p>
          ) : verses.length ? (
            <div className="flex flex-wrap gap-1.5">
              {verses.map((r, i) => (
                <button key={i} onClick={() => onVerse(r)}
                  className={`px-2.5 py-0.5 rounded-full text-xs border transition duration-100 active:scale-90 ${isLiveVerse(r) ? "bg-green-600 border-green-600 text-white" : "border-blue-400/60 text-blue-300 hover:bg-blue-400/10"}`}>
                  {refOf(r)}
                </button>
              ))}
            </div>
          ) : !isChant ? (
            <p className="text-xs text-neutral-500">Aucun verset repéré dans cette note.</p>
          ) : null}
        </div>

        {kind === "notes" && !hideKeys && (
          <div className="mb-3">
            <div className="text-xs text-neutral-500 mb-1.5">Phrases clés</div>
            {!(open.keys || []).length ? (
              <p className="text-xs text-neutral-500">Aucune pour l'instant. L'orateur dit une phrase importante ? Elle sera gardée ici pour la reprojeter quand il y revient.</p>
            ) : (
              <ul className="space-y-1">
                {open.keys.map((s, k) => {
                  const live = liveSlide && liveSlide.id === open.id && liveSlide.key === k;
                  return (
                    <li key={k} onClick={() => onKeyPhrase(open, k)}
                      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer select-none text-sm leading-snug border transition duration-100 active:scale-[0.98] ${live ? "bg-green-600 border-green-600 text-white" : "border-amber-400/30 bg-amber-400/5 text-neutral-200 hover:bg-amber-400/10"}`}>
                      <span className="flex-1 whitespace-pre-line">{s}</span>
                      <button aria-label="Retirer cette phrase" title="Retirer"
                        onClick={(e) => { e.stopPropagation(); onUpdate(open.id, { keys: open.keys.filter((_, j) => j !== k) }); }}
                        className={`px-1 text-base leading-none ${live ? "text-green-100 hover:text-white" : "text-neutral-500 hover:text-red-400"}`}>×</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {kind === "notes" && canAnalyze && (
          <div className="mb-3">
            {!ana ? (
              <button disabled={open.text.trim().length < 40} onClick={analyze}
                className="w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                Analyser la note (points clés)
              </button>
            ) : ana.status === "loading" ? (
              <p className="text-xs text-neutral-400">Analyse en cours…</p>
            ) : ana.status === "error" ? (
              <div className="text-xs">
                <p className="text-red-400 mb-1.5">{ana.msg}</p>
                <button onClick={analyze} className="text-sky-300 hover:underline mr-3">Réessayer</button>
                <button onClick={() => setAna(null)} className="text-neutral-500 hover:text-white">Fermer</button>
              </div>
            ) : (
              <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-2">
                <div className="text-xs text-neutral-400 mb-1.5">Points clés proposés : coche ceux à garder</div>
                {!ana.points.length ? <p className="text-xs text-neutral-500">Tout est déjà gardé dans la note.</p> : (
                  <ul className="space-y-1">
                    {ana.points.map((pt, i) => (
                      <li key={i}>
                        <label className="flex items-start gap-2 px-1.5 py-1 rounded-md hover:bg-neutral-800 cursor-pointer text-sm leading-snug">
                          <input type="checkbox" checked={ana.sel.includes(i)} className="mt-1"
                            onChange={() => setAna((a) => ({ ...a, sel: a.sel.includes(i) ? a.sel.filter((x) => x !== i) : [...a.sel, i] }))} />
                          <span className="flex-1 whitespace-pre-line">{pt}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button disabled={!ana.sel.length} onClick={keepAnalysis}
                    className="px-3 py-1.5 rounded-lg text-sm bg-sky-400 hover:bg-sky-300 text-black font-medium transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                    Garder la sélection ({ana.sel.length})
                  </button>
                  <button onClick={() => setAna(null)} className="text-xs text-neutral-500 hover:text-white">Fermer</button>
                </div>
              </div>
            )}
          </div>
        )}

        {kind === "notes" && (
          <button onClick={() => setShowText((v) => !v)} className="mb-2 text-xs text-neutral-400 hover:text-amber-400">
            {showText ? "▾ Masquer le texte complet" : "▸ Voir tout le texte"}
          </button>
        )}
        {(isChant || showText) && (<>
        <div className="text-xs text-neutral-500 mb-1.5">{kind === "notes" ? "Texte de la note" : "Couplets et refrains"}</div>
        <ul className="space-y-1">
          {slides.map((s, i) => {
            const live = liveSlide && liveSlide.id === open.id && liveSlide.i === i;
            return (
              <li key={i} id={`s-${open.id}-${i}`} onClick={() => onSlide(open, i, slides)} title={s}
                className={`flex gap-2 px-2.5 py-2 rounded-lg cursor-pointer select-none text-sm leading-snug transition duration-100 active:scale-[0.98] ${isChant ? "border " + (live ? "border-green-600 " : "border-neutral-700 ") : ""}${live ? "bg-green-600 text-white" : "text-neutral-300 hover:bg-neutral-700"}`}>
                <b className={`font-medium min-w-4 ${live ? "text-green-100" : "text-neutral-500"}`}>{i + 1}</b>
                <span className={isChant ? "whitespace-pre-line text-center flex-1 font-medium" : "line-clamp-2 whitespace-pre-line"}>{s}</span>
              </li>
            );
          })}
        </ul>
        </>)}
      </div>
    );
  }

  /* ───── liste ───── */
  return (
    <div>
      {kind === "chants" && playlists && (
        <ChantPlaylists playlists={playlists} chants={items} selectedId={selectedId} onPick={onPick} />
      )}
      <div className={kind === "chants" ? "rounded-lg border border-neutral-700 bg-neutral-900/40 p-2.5" : ""}>
      {kind === "chants" && <div className="text-sm font-medium mb-1.5">{t.list}</div>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className={`${field} mb-2`} />
      <button onClick={startAdd}
        className="w-full mb-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-sm font-medium transition duration-100 active:scale-95">+ {t.add}</button>
      {!ready ? null : !items.length ? (
        <p className="text-sm text-neutral-500 mt-3">{t.empty} Utilise le bouton ci-dessus pour en ajouter.</p>
      ) : !filtered.length ? (
        <p className="text-sm text-neutral-500 mt-3">Aucun résultat.</p>
      ) : (
        groups.map(([g, list]) => (
          <div key={g || "all"}>
            {g && <div className="text-[11px] text-neutral-500 mt-3 mb-1.5">{g}</div>}
            {list.map((x) => (
              <button key={x.id} onClick={() => (kind === "chants" ? onPick?.(x.id) : setOpenId(x.id))}
                className={`block w-full text-left px-3 py-2 rounded-lg mb-1 transition duration-100 active:scale-[0.98] ${selectedId === x.id ? "bg-amber-400 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                <span className="block text-sm font-medium truncate">{x.title}</span>
                {x.person && <span className={`block text-xs truncate ${selectedId === x.id ? "text-black/60" : "text-neutral-500"}`}>{x.person}</span>}
              </button>
            ))}
          </div>
        ))
      )}
      </div>
    </div>
  );
}
