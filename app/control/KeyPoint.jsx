"use client";
import { useState } from "react";

// Point clé : l'orateur dit une phrase importante, l'admin ou l'aide écran la tape ici.
// Un seul bouton : « Projeter et garder » → la phrase est projetée et gardée dans la note ouverte.
// Les phrases gardées sont listées dessous : clic = reprojeter, crayon = modifier, poubelle = supprimer.
// Différent du « Texte rapide » (texte libre, jamais gardé).
const Pencil = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg>
);
const Trash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" /></svg>
);

export default function KeyPoint({ note, liveKey, canProject, onKeepProject, onProjectKey, onEdit, onDelete }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(null);   // index de la phrase en cours de modification
  const [draft, setDraft] = useState("");
  const t = text.trim();
  const keys = note?.keys || [];
  const go = () => { if (!t || !note || !canProject) return; onKeepProject(t); setText(""); };
  const startEdit = (k) => { setEditing(k); setDraft(keys[k]); };
  const saveEdit = () => { const d = draft.trim(); if (d) onEdit(editing, d); setEditing(null); };
  const icon = "p-1.5 rounded-md transition duration-100 active:scale-90";

  return (
    <div className="mt-2 rounded-xl bg-sky-400/5 border border-sky-400/30 p-2.5 sm:p-3">
      <div className="text-sm font-medium mb-1.5">Point clé</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && t) { e.preventDefault(); go(); }
          else if (e.key === "Escape") e.target.blur();
        }}
        placeholder="Phrase dite par l'orateur : à garder dans la note et à projeter"
        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-sky-400 resize-y" />
      <div className="flex items-center gap-2 mt-1.5">
        <button disabled={!t || !note || !canProject} onClick={go} title="Ctrl+Entrée"
          className="px-3 py-1.5 rounded-lg text-sm bg-sky-400 hover:bg-sky-300 text-black font-medium transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
          Projeter et garder
        </button>
        {text && <button onClick={() => setText("")} className="ml-auto text-xs text-neutral-500 hover:text-white">Vider</button>}
      </div>
      {!note && <p className="mt-1.5 text-[11px] text-neutral-500">Ouvre une note pour pouvoir y garder les points clés.</p>}
      {note && !canProject && <p className="mt-1.5 text-[11px] text-neutral-500">L'administrateur doit t'autoriser pour projeter.</p>}

      {note && (
        <div className="border-t border-neutral-700 mt-3 pt-2.5">
          <div className="text-xs text-neutral-400 mb-1.5">Gardés dans la note · {note.title}</div>
          {!keys.length ? (
            <p className="text-xs text-neutral-500">Aucun point clé gardé pour l'instant.</p>
          ) : (
            <ul className="space-y-1.5">
              {keys.map((s, k) => {
                const live = liveKey === k;
                if (editing === k) return (
                  <li key={k} className="flex items-start gap-1.5 rounded-lg border border-neutral-500 px-2 py-1.5">
                    <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                        else if (e.key === "Escape") setEditing(null);
                      }}
                      className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 ring-sky-400 resize-y" />
                    <button aria-label="Valider" title="Valider" onClick={saveEdit} className={`${icon} text-green-400 hover:bg-neutral-700`}>✓</button>
                    <button aria-label="Annuler" title="Annuler" onClick={() => setEditing(null)} className={`${icon} text-neutral-400 hover:bg-neutral-700`}>✕</button>
                  </li>
                );
                return (
                  <li key={k} onClick={() => onProjectKey(k)}
                    className={`flex items-start gap-1 pl-2.5 pr-1 py-1.5 rounded-lg border text-sm leading-snug select-none transition duration-100 ${canProject ? "cursor-pointer active:scale-[0.99]" : ""} ${live ? "bg-green-600 border-green-600 text-white" : "border-neutral-700 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-800"}`}>
                    <span className="flex-1 whitespace-pre-line py-0.5">{s}{live && <span className="block text-[11px] text-green-100">À l'écran</span>}</span>
                    <button aria-label="Modifier cette phrase" title="Modifier" onClick={(e) => { e.stopPropagation(); startEdit(k); }}
                      className={`${icon} ${live ? "text-green-100 hover:text-white" : "text-neutral-400 hover:text-white"}`}><Pencil /></button>
                    <button aria-label="Supprimer cette phrase" title="Supprimer" onClick={(e) => { e.stopPropagation(); onDelete(k); }}
                      className={`${icon} ${live ? "text-green-100 hover:text-white" : "text-neutral-400 hover:text-red-400"}`}><Trash /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
