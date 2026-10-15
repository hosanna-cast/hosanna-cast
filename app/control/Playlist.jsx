"use client";
import { useState } from "react";

const ICON = { verse: "📖", chants: "🎵", notes: "📝", text: "💬" };

// Playlist du culte : l'ordre du service, à préparer avant et à dérouler avec « Suivant ».
export default function Playlist({ items, activeId, canProject, lib, onPlay, onNext, onPrev, onRemove, onMove, onClear, onAddRef, onAddLib, onAddText, onAddCurrent, canAddCurrent }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState(null);          // null | "ref" | "lib" | "text"
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const idx = items.findIndex((x) => x.id === activeId);

  const submit = (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    if (mode === "ref") { if (!onAddRef(val)) return setErr("Verset introuvable"); }
    if (mode === "text") onAddText(val);
    setVal(""); setErr(""); setMode(null);
  };

  const small = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

  return (
    <section className="mt-3 lg:mt-4 rounded-xl border border-neutral-700 bg-neutral-900">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium">Playlist du culte <span className="text-neutral-500 font-normal">· {items.length}</span></span>
        <span className="text-neutral-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button className={small + " py-1.5"} disabled={!canProject || idx <= 0} onClick={onPrev}>⏮ Élément préc.</button>
              <button className="rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                disabled={!canProject || idx >= items.length - 1} onClick={onNext}>{idx < 0 ? "▶ Démarrer" : "Élément suiv. ⏭"}</button>
            </div>
          )}

          {items.length === 0 && (
            <p className="px-1 py-2 text-xs text-neutral-500 leading-5">Prépare l'ordre du culte : ajoute versets, chants, notes ou annonces, puis avance avec « Suivant » (ou la touche <b className="text-neutral-300">Page ↓</b>).</p>
          )}

          <ol className="max-h-64 overflow-y-auto space-y-1">
            {items.map((it, i) => (
              <li key={it.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${it.id === activeId ? "bg-amber-400 text-black" : "bg-neutral-800"}`}>
                <button disabled={!canProject} onClick={() => onPlay(it)} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:cursor-default" title="Projeter">
                  <span className={`text-xs w-4 text-center ${it.id === activeId ? "text-black/60" : "text-neutral-500"}`}>{i + 1}</span>
                  <span className="shrink-0">{ICON[it.k]}</span>
                  <span className="truncate">{it.title}</span>
                </button>
                <span className={`flex items-center gap-0.5 ${it.id === activeId ? "" : "opacity-60 group-hover:opacity-100"}`}>
                  <button onClick={() => onMove(it.id, -1)} disabled={i === 0} aria-label="Monter" className="px-1 text-xs disabled:opacity-20">↑</button>
                  <button onClick={() => onMove(it.id, 1)} disabled={i === items.length - 1} aria-label="Descendre" className="px-1 text-xs disabled:opacity-20">↓</button>
                  <button onClick={() => onRemove(it.id)} aria-label="Retirer" className="px-1 text-xs hover:text-red-500">✕</button>
                </span>
              </li>
            ))}
          </ol>

          {mode === null && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className={small} onClick={() => setMode("ref")}>＋ Verset</button>
              <button className={small} onClick={() => setMode("lib")}>＋ Chant / note</button>
              <button className={small} onClick={() => setMode("text")}>＋ Annonce</button>
              <button className={small} disabled={!canAddCurrent} onClick={onAddCurrent} title="Ajouter ce qui est à l'écran">＋ À l'écran</button>
              {items.length > 0 && <button className={small + " ml-auto text-neutral-400"} onClick={() => { if (confirm("Vider la playlist ?")) onClear(); }}>Vider</button>}
            </div>
          )}

          {(mode === "ref" || mode === "text") && (
            <form onSubmit={submit} className="mt-2 flex flex-col gap-1.5">
              {mode === "ref"
                ? <input autoFocus value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} placeholder="Ex. Jean 3:16 ou Rom 8 28-30" className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
                : <textarea autoFocus rows={3} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Texte de l'annonce (affiché tel quel à l'écran)" className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400" />}
              {err && <span className="text-xs text-red-400">{err}</span>}
              <div className="flex gap-1.5">
                <button className="flex-1 rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 active:scale-95">Ajouter</button>
                <button type="button" className={small} onClick={() => { setMode(null); setVal(""); setErr(""); }}>Annuler</button>
              </div>
            </form>
          )}

          {mode === "lib" && (
            <div className="mt-2 flex flex-col gap-1.5">
              <select autoFocus defaultValue="" onChange={(e) => { if (!e.target.value) return; const [kind, id] = e.target.value.split("|"); onAddLib(kind, id); setMode(null); }}
                className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400">
                <option value="">Choisir…</option>
                {lib.chants.length > 0 && <optgroup label="Chants">{lib.chants.map((x) => <option key={x.id} value={`chants|${x.id}`}>{x.title}</option>)}</optgroup>}
                {lib.notes.length > 0 && <optgroup label="Notes">{lib.notes.map((x) => <option key={x.id} value={`notes|${x.id}`}>{x.title}</option>)}</optgroup>}
              </select>
              <button type="button" className={small} onClick={() => setMode(null)}>Annuler</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
