"use client";
import { useEffect, useMemo, useState } from "react";
import { splitSlides, slidesOf } from "@/lib/library";
import { findRefs } from "@/lib/refs";
import { parseRef } from "@/lib/parseRef";
import Cutter, { linesFromSlides, slidesFromLines } from "./Cutter";

const field = "w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-amber-400";
const ghost = "px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm transition duration-100 active:scale-95";

// Écran dédié aux chants : le chant ouvert occupe toute la colonne centrale.
export default function ChantStage({ item, bible, refOf, textOf, isLiveVerse, liveSlide, pausedSlide, onSlide, onVerse, onFree, onUpdate, onRemove }) {
  const [mode, setMode] = useState("view");               // "view" | "all" (tout le texte) | "cut" (choisir les coupures)
  const [f, setF] = useState({ title: "", person: "", text: "" });
  const [error, setError] = useState("");
  const [vq, setVq] = useState("");
  const [free, setFree] = useState("");
  const [titleEdit, setTitleEdit] = useState(null);    // null = titre affiché, sinon texte en cours de saisie
  const [edit, setEdit] = useState(null);                 // { i, isNew } : un seul couplet en cours de modification
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState([]);                 // mode "cut" : [{ t, cut }]  (cut = coupure après cette ligne)

  const slides = useMemo(() => (item ? slidesOf(item) : []), [item]);
  const detected = useMemo(() => (item ? findRefs(item.text, bible) : []), [item, bible]);

  const vResults = useMemo(() => {
    const ref = bible && vq.trim() ? parseRef(vq) : null;
    if (!ref) return [];
    return ref.books.slice(0, 4).map((b) => {
      const c = ref.chapter ? ref.chapter - 1 : 0;
      const v = ref.verse ? ref.verse - 1 : 0;
      if (bible[b]?.[c]?.[v] === undefined) return null;
      return { b, c, v, vEnd: ref.verseEnd ? ref.verseEnd - 1 : null };
    }).filter(Boolean);
  }, [vq, bible]);

  useEffect(() => { setMode("view"); setEdit(null); setTitleEdit(null); setVq(""); setFree(""); setError(""); }, [item?.id]);

  useEffect(() => {
    if (liveSlide && item && liveSlide.id === item.id)
      document.getElementById(`c-${item.id}-${liveSlide.i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [liveSlide]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-10 text-center text-neutral-500">
        <div className="text-3xl mb-2">♪</div>
        Choisis un chant dans la liste à gauche, ou ajoute-en un avec <span className="text-amber-400">+</span>.
      </div>
    );
  }

  // enregistre la liste de diapositives ; si la diapositive à l'écran a changé, l'écran est mis à jour
  const commit = (next, refreshIdx) => {
    onUpdate(item.id, { slides: next, text: next.join("\n\n") });
    if (refreshIdx != null && liveSlide && liveSlide.id === item.id && liveSlide.i === refreshIdx && next[refreshIdx]) onSlide(item, refreshIdx, next);
  };

  /* ───── tout le texte ───── */
  const startAll = () => { setF({ title: item.title, person: item.person || "", text: slides.join("\n\n") }); setError(""); setMode("all"); };
  const saveAll = () => {
    const text = f.text.trim();
    if (!text) { setError("Les paroles ne peuvent pas être vides."); return; }
    const next = splitSlides(text, Infinity);              // on respecte exactement les lignes vides
    onUpdate(item.id, { title: f.title.trim() || text.split("\n")[0].slice(0, 60), person: f.person.trim(), slides: next, text: next.join("\n\n") });
    setMode("view");
  };

  /* ───── choisir où couper ───── */
  const startCut = () => { setLines(linesFromSlides(slides)); setMode("cut"); };
  const toggleCut = (i) => setLines((cur) => cur.map((l, k) => (k === i ? { ...l, cut: !l.cut } : l)));
  const saveCut = () => { commit(slidesFromLines(lines)); setMode("view"); };

  /* ───── un seul couplet ───── */
  const saveEdit = () => {
    const t = draft.trim();
    if (!t) return;
    const next = [...slides];
    if (edit.isNew) next.splice(edit.i, 0, t); else next[edit.i] = t;
    commit(next, edit.isNew ? null : edit.i);
    setEdit(null);
  };
  const removeSlide = (i) => {
    if (!window.confirm(`Supprimer la diapositive ${i + 1} ?`)) return;
    commit(slides.filter((_, k) => k !== i));
  };
  const addFree = () => {
    const t = free.trim();
    if (!t) return;
    const at = liveSlide && liveSlide.id === item.id ? liveSlide.i + 1 : slides.length;
    const next = [...slides]; next.splice(at, 0, t);
    commit(next);
    setFree("");
  };

  const paused = pausedSlide && pausedSlide.id === item.id ? pausedSlide : null;

  if (mode === "all") {
    return (
      <div className="rounded-xl bg-neutral-800/60 border border-neutral-700 p-4 space-y-2">
        <div className="text-sm font-medium text-amber-400">Modifier tout le texte</div>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Titre" className={field} />
        <input value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder="Auteur (facultatif)" className={field} />
        <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={18} className={`${field} resize-y leading-relaxed text-base`} />
        <p className="text-xs text-neutral-500">Une ligne vide (ou une ligne <span className="text-neutral-300">---</span>) = nouvelle diapositive. Pour modifier un seul couplet, utilise le crayon sur sa carte.</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2 pt-1 max-w-sm">
          <button onClick={() => setMode("view")} className={ghost}>Annuler</button>
          <button onClick={saveAll} className="rounded-lg bg-amber-400 text-black font-medium py-2 text-sm transition duration-100 active:scale-95">Enregistrer</button>
        </div>
      </div>
    );
  }

  if (mode === "cut") {
    return (
      <div className="rounded-xl bg-neutral-800/60 border border-neutral-700 p-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="text-sm font-medium text-amber-400">Choisir où couper</div>
          <div className="flex gap-2">
            <button onClick={() => setMode("view")} className={ghost}>Annuler</button>
            <button onClick={saveCut} className="rounded-lg bg-amber-400 text-black font-medium px-4 py-1.5 text-sm transition duration-100 active:scale-95">Enregistrer</button>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-3">Clique entre deux lignes pour couper ou retirer une coupure. Chaque bloc deviendra une diapositive.</p>
        <Cutter lines={lines} onToggle={toggleCut} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {titleEdit !== null ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={titleEdit} onChange={(e) => setTitleEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { if (titleEdit.trim()) onUpdate(item.id, { title: titleEdit.trim() }); setTitleEdit(null); }
                  if (e.key === "Escape") setTitleEdit(null);
                }}
                className="min-w-0 flex-1 bg-neutral-900 border border-amber-400 rounded-lg px-3 py-1 text-lg font-semibold outline-none" />
              <button onClick={() => { if (titleEdit.trim()) onUpdate(item.id, { title: titleEdit.trim() }); setTitleEdit(null); }}
                className="rounded-lg bg-amber-400 text-black font-medium px-3 py-1.5 text-sm transition duration-100 active:scale-95">OK</button>
              <button onClick={() => setTitleEdit(null)} className={ghost}>Annuler</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xl font-semibold leading-tight truncate">{item.title}</h2>
              <button onClick={() => setTitleEdit(item.title)} title="Modifier le titre"
                className="shrink-0 w-7 h-7 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 text-sm transition duration-100 active:scale-90">✎</button>
            </div>
          )}
          <div className="text-xs text-neutral-500 mt-0.5">
            {[item.person, `${slides.length} diapositive${slides.length > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 shrink-0">
          <button onClick={startCut} className={`${ghost} text-amber-400`}>✂ Découper</button>
          <button onClick={startAll} className={ghost}>Tout le texte</button>
          <button onClick={() => { if (window.confirm(`Supprimer « ${item.title} » ?`)) onRemove(item.id); }} className={`${ghost} text-neutral-400 hover:text-red-400`}>Supprimer</button>
        </div>
      </div>

      {/* le chantre cite un verset / change une parole */}
      <div className="rounded-xl bg-blue-400/5 border border-blue-400/30 p-3 mb-4 space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-blue-300">Le chantre cite un verset ?</span>
            <input value={vq} onChange={(e) => setVq(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && vResults[0]) { onVerse(vResults[0]); setVq(""); } }}
              placeholder={bible ? "jn 3 16 puis Entrée" : "Chargement de la Bible…"}
              className="flex-1 min-w-40 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-blue-400" />
            {paused && (
              <button onClick={() => onSlide(item, paused.i, slides)}
                className="rounded-lg bg-amber-400 text-black font-medium px-3 py-1.5 text-sm transition duration-100 active:scale-95">
                ↩ Reprendre le chant (n°{paused.i + 1})
              </button>
            )}
          </div>
          {vResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {vResults.map((r, i) => (
                <button key={i} onClick={() => { onVerse(r); setVq(""); }}
                  className="block w-full text-left px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm transition duration-100 active:scale-[0.99]">
                  <b className="font-medium text-blue-300">{refOf(r)}</b>{" "}
                  <span className="text-neutral-400">{textOf(r).slice(0, 120)}</span>
                </button>
              ))}
            </div>
          )}
          {detected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-neutral-500 mr-1">Dans les paroles :</span>
              {detected.map((r, i) => (
                <button key={i} onClick={() => onVerse(r)}
                  className={`px-2.5 py-0.5 rounded-full text-xs border transition duration-100 active:scale-90 ${isLiveVerse(r) ? "bg-green-600 border-green-600 text-white" : "border-blue-400/60 text-blue-300 hover:bg-blue-400/10"}`}>
                  {refOf(r)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm text-blue-300 mb-1.5">Le chantre change une parole ? Texte libre</div>
          <textarea value={free} onChange={(e) => setFree(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && free.trim()) { e.preventDefault(); onFree(item, free.trim()); } }}
            placeholder="Tape ici ce qui est chanté (une ligne par ligne à l'écran)"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-400 resize-y" />
          <div className="flex gap-2 mt-1.5">
            <button disabled={!free.trim()} onClick={() => onFree(item, free.trim())}
              className="rounded-lg bg-amber-400 text-black font-medium px-3 py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">Projeter (Ctrl+Entrée)</button>
            <button disabled={!free.trim()} onClick={addFree} className={`${ghost} disabled:opacity-40 disabled:pointer-events-none`}>+ Ajouter au chant</button>
          </div>
        </div>
      </div>

      {/* couplets et refrains */}
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {slides.map((s, i) => {
          const live = liveSlide && liveSlide.id === item.id && liveSlide.i === i;
          if (edit && !edit.isNew && edit.i === i) {
            return (
              <div key={i} className="rounded-xl border border-amber-400 bg-neutral-800 p-2 space-y-2">
                <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.max(4, draft.split("\n").length + 1)} className={`${field} text-center font-semibold`} />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEdit(null)} className={ghost}>Annuler</button>
                  <button onClick={saveEdit} className="rounded-lg bg-amber-400 text-black font-medium py-1.5 text-sm transition duration-100 active:scale-95">OK</button>
                </div>
              </div>
            );
          }
          return (
            <div key={i} id={`c-${item.id}-${i}`} role="button" tabIndex={0} onClick={() => onSlide(item, i, slides)}
              onKeyDown={(e) => { if (e.key === "Enter") onSlide(item, i, slides); }}
              className={`group relative text-center rounded-xl border px-4 py-5 pt-7 whitespace-pre-line leading-snug font-semibold text-base cursor-pointer select-none transition duration-100 active:scale-[0.98] ${live ? "bg-green-600 border-green-500 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-100 hover:border-amber-400/60 hover:bg-neutral-700/70"}`}>
              <span className={`absolute top-1.5 left-2.5 text-xs font-medium ${live ? "text-green-100" : "text-neutral-500"}`}>{i + 1}</span>
              <span className="absolute top-1 right-1.5 flex gap-1 opacity-60 group-hover:opacity-100">
                <button title="Modifier cette diapositive" onClick={(e) => { e.stopPropagation(); setEdit({ i, isNew: false }); setDraft(s); }}
                  className="w-6 h-6 rounded-md bg-black/30 hover:bg-black/60 text-xs">✎</button>
                <button title="Supprimer cette diapositive" onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                  className="w-6 h-6 rounded-md bg-black/30 hover:bg-red-600 text-xs">✕</button>
              </span>
              {s}
            </div>
          );
        })}

        {edit?.isNew ? (
          <div className="rounded-xl border border-amber-400 bg-neutral-800 p-2 space-y-2">
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="Nouvelle diapositive" className={`${field} text-center font-semibold`} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEdit(null)} className={ghost}>Annuler</button>
              <button onClick={saveEdit} className="rounded-lg bg-amber-400 text-black font-medium py-1.5 text-sm transition duration-100 active:scale-95">Ajouter</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setEdit({ i: slides.length, isNew: true }); setDraft(""); }}
            className="rounded-xl border border-dashed border-neutral-600 py-5 text-sm text-neutral-400 hover:text-amber-400 hover:border-amber-400/60 transition duration-100 active:scale-[0.98]">
            + Ajouter une diapositive
          </button>
        )}
      </div>
    </div>
  );
}
