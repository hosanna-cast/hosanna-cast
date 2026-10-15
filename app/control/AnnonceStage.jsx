"use client";
import { useState } from "react";

const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

// Centre de la console, onglet Annonces : aperçu de ce qui est à l'écran + commandes de la vidéo.
export default function AnnonceStage({ item, live, blank, canProject, canStep, onStep, onCmd }) {
  const [muted, setMuted] = useState(false);

  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-500 text-sm leading-6">
        Choisis une photo ou une vidéo à gauche pour l'afficher à l'écran.<br />
        <span className="text-neutral-600">Les annonces s'effacent toutes seules après 3 jours.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl bg-black border border-neutral-700 overflow-hidden aspect-video flex items-center justify-center">
        {item.kind === "image"
          ? <img src={item.url} alt="" className="max-w-full max-h-full object-contain" />
          : <video src={item.url} preload="metadata" muted playsInline className="max-w-full max-h-full object-contain pointer-events-none" />}
        <span className={`absolute top-2 left-3 text-xs ${blank ? "text-neutral-400" : live ? "text-green-400" : "text-neutral-500"}`}>
          {blank ? "● Écran noir" : live ? "● À l'écran" : "○ Pas à l'écran"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{item.kind === "video" ? "🎬 " : ""}{item.name}</div>
          <div className="text-xs text-neutral-500">{item.kind === "video" ? "Vidéo" : "Photo"}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button className={btn} disabled={!canStep} onClick={() => onStep(-1)}>← Préc.</button>
          <button className={btn} disabled={!canStep} onClick={() => onStep(1)}>Suiv. →</button>
        </div>
      </div>

      {item.kind === "video" && (
        <div>
          <div className="grid grid-cols-3 gap-1.5">
            <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("toggle")}>⏯ Lecture / Pause</button>
            <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("restart")}>⏮ Recommencer</button>
            <button className={btn} disabled={!live || !canProject} onClick={() => { onCmd(muted ? "unmute" : "mute"); setMuted(!muted); }}>{muted ? "🔊 Son" : "🔇 Couper le son"}</button>
          </div>
          <p className="mt-2 text-xs text-neutral-500 leading-5">
            La vidéo démarre toute seule à l'écran. Si le son ne part pas, clique <b className="text-neutral-300">une fois</b> sur la page de l'écran de projection (le navigateur l'exige) : ça n'est à faire qu'une fois.
          </p>
        </div>
      )}
    </div>
  );
}
