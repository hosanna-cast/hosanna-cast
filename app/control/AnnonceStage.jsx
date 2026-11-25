"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

// Ce que dit l'écran de projection au sujet de la vidéo
const STATUS = {
  playing: ["text-green-400", "as.playing"],
  muted: ["text-amber-300", "as.muted"],
  error: ["text-red-400", "as.error"],
};

// Onglet Annonces : commandes de la vidéo à l'écran (lecture, recommencer, son).
// L'aperçu de ce qui est projeté se trouve dans la colonne de droite : on ne le répète plus ici.
export default function AnnonceStage({ item, live, blank, canProject, onCmd, status }) {
  const tr = useT();
  const [muted, setMuted] = useState(false);
  if (!item || item.kind !== "video") return null;

  const st = live && !blank ? STATUS[status] : null;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-800/60 p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">🎬 {item.name}</span>
        <span className={`shrink-0 text-xs ${blank ? "text-neutral-400" : live ? "text-green-400" : "text-neutral-500"}`}>
          {blank ? tr("scr.black") : live ? tr("scr.live") : tr("as.notLive")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("toggle")}>{tr("as.toggle")}</button>
        <button className={btn} disabled={!live || !canProject} onClick={() => onCmd("restart")}>{tr("as.restart")}</button>
        <button className={btn} disabled={!live || !canProject} onClick={() => { onCmd(muted ? "unmute" : "mute"); setMuted(!muted); }}>{muted ? tr("as.sound") : tr("as.mute")}</button>
      </div>
      {live && !blank && (
        <p className={`mt-2 text-xs leading-5 ${st ? st[0] : "text-neutral-500"}`}>
          {st ? tr(st[1]) : tr("as.waiting")}
        </p>
      )}
      {!live && <p className="mt-2 text-xs text-neutral-500 leading-5">{tr("as.clickHint")}</p>}
    </div>
  );
}
