"use client";
import { useState } from "react";

// Point clé : l'orateur dit une phrase importante, l'admin ou l'aide écran la tape ici.
// On peut la garder dans la note ouverte (elle devient une diapo de la note), la projeter, ou les deux.
// Différent du « Texte rapide » (texte libre, jamais gardé sauf si on le demande).
export default function KeyPoint({ noteOpen, canProject, onKeep, onProject, onKeepProject }) {
  const [text, setText] = useState("");
  const t = text.trim();
  const keepProject = () => { if (!t || !noteOpen || !canProject) return; onKeepProject(t); setText(""); };
  const keep = () => { if (!t || !noteOpen) return; onKeep(t); setText(""); };
  const project = () => { if (t && canProject) onProject(t); };
  const small = "px-3 py-1.5 rounded-lg text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className="mt-2 rounded-xl bg-sky-400/5 border border-sky-400/30 p-2.5 sm:p-3">
      <div className="text-sm font-medium mb-1.5">Point clé</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && t) { e.preventDefault(); noteOpen ? keepProject() : project(); }
          else if (e.key === "Escape") e.target.blur();
        }}
        placeholder="Phrase dite par l'orateur : à garder dans la note et/ou à projeter"
        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-sky-400 resize-y" />
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <button disabled={!t || !noteOpen || !canProject} onClick={keepProject} className={`${small} bg-sky-400 hover:bg-sky-300 text-black font-medium`}>Projeter et garder</button>
        <button disabled={!t || !noteOpen} onClick={keep} className={`${small} bg-neutral-800 hover:bg-neutral-700`}>Garder</button>
        <button disabled={!t || !canProject} onClick={project} className={`${small} bg-neutral-800 hover:bg-neutral-700`}>Projeter</button>
        {text && <button onClick={() => setText("")} className="ml-auto text-xs text-neutral-500 hover:text-white">Vider</button>}
      </div>
      {!noteOpen && <p className="mt-1.5 text-[11px] text-neutral-500">Ouvre une note pour pouvoir y garder le point clé. Tu peux déjà le projeter.</p>}
    </div>
  );
}
