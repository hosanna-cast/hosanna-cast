"use client";
import { useState } from "react";

const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

// Ce que dit l'écran de projection au sujet de la vidéo
const STATUS = {
  playing: ["text-green-400", "▶ La vidéo joue à l'écran de projection"],
  muted: ["text-amber-300", "🔇 La vidéo joue sans son : clique une fois sur la page de l'écran de projection pour activer le son"],
  error: ["text-red-400", "⚠ L'écran de projection n'arrive pas à lire cette vidéo (format non pris en charge). Convertis-la en MP4 (H.264) puis ajoute-la de nouveau."],
};

// Onglet Annonces : commandes de la vidéo à l'écran (lecture, recommencer, son).
// L'aperçu de ce qui est projeté se trouve dans la colonne de droite : on ne le répète plus ici.
export default function AnnonceStage({ item, live, blank, canProject, onCmd, status }) {
  const [muted, setMuted] = useState(false);
  if (!item || item.kind !== "video") return null;

  const st = live && !blank ? STATUS[status] : null;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-800/60 p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">🎬 {item.name}</span>
        <span className={`shrink-0 text-xs ${blank ? "text-neutral-400" : live ? "text-green-400" : "text-neutral-500"}`}>
          {blank ? "● Écran noir" : live ? "● À l'écran" : "○ Pas à l'écran"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("toggle")}>⏯ Lecture / Pause</button>
        <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("restart")}>⏮ Recommencer</button>
        <button className={btn} disabled={!live || !canProject} onClick={() => { onCmd(muted ? "unmute" : "mute"); setMuted(!muted); }}>{muted ? "🔊 Son" : "🔇 Couper le son"}</button>
      </div>
      {live && !blank && (
        <p className={`mt-2 text-xs leading-5 ${st ? st[0] : "text-neutral-500"}`}>
          {st ? st[1] : "En attente de l'écran de projection… Ouvre la page « Écran » (bouton jaune en haut) : la vidéo joue là-bas."}
        </p>
      )}
      {!live && <p className="mt-2 text-xs text-neutral-500 leading-5">Clique la vidéo dans la grille pour la lancer à l'écran. Elle joue sur la page « Écran ».</p>}
    </div>
  );
}
