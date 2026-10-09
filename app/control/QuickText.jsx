"use client";
import { useState } from "react";

// Texte rapide : toujours en haut de la colonne centrale (Bible, Notes, Chants).
// Une ligne tapée = une ligne à l'écran. Le texte reste dans le champ après projection.
export default function QuickText({ onProject, onAdd, addLabel, disabled }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const t = text.trim();
  const project = () => { if (t && !disabled) onProject(t); };

  return (
    <div className="rounded-xl bg-amber-400/5 border border-amber-400/30 p-2.5 sm:p-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        rows={open || text.includes("\n") ? 3 : 1}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && t) { e.preventDefault(); project(); }
          else if (e.key === "Escape") e.target.blur();
        }}
        placeholder="Texte rapide : tape ici ce qui doit s'afficher (une ligne par ligne à l'écran)"
        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-amber-400 resize-y" />
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <button disabled={!t || disabled} onClick={project}
          className="rounded-lg bg-amber-400 text-black font-medium px-3 py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
          Projeter (Ctrl+Entrée)
        </button>
        {onAdd && (
          <button disabled={!t} onClick={() => { onAdd(t); setText(""); }}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
            {addLabel}
          </button>
        )}
        {text && (
          <button onClick={() => setText("")} className="ml-auto text-xs text-neutral-500 hover:text-white">Vider</button>
        )}
      </div>
    </div>
  );
}
