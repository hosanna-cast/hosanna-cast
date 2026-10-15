"use client";
import { useEffect, useRef, useState } from "react";
import { daysText } from "@/lib/expiry";

const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";

// Ce que dit l'écran de projection au sujet de la vidéo
const STATUS = {
  playing: ["text-green-400", "▶ La vidéo joue à l'écran de projection"],
  muted: ["text-amber-300", "🔇 La vidéo joue sans son : clique une fois sur la page de l'écran de projection pour activer le son"],
  error: ["text-red-400", "⚠ L'écran de projection n'arrive pas à lire cette vidéo (format non pris en charge). Convertis-la en MP4 (H.264) puis ajoute-la de nouveau."],
};

// Centre de la console, onglet Annonces : aperçu de ce qui est à l'écran + commandes de la vidéo.
export default function AnnonceStage({ item, live, blank, canProject, canStep, onStep, onCmd, status }) {
  const [muted, setMuted] = useState(false);
  const [localErr, setLocalErr] = useState(false);
  const vref = useRef(null);

  // l'aperçu (sans son) suit la projection : il démarre quand la vidéo est envoyée à l'écran
  useEffect(() => {
    setLocalErr(false);
    setMuted(false);
    const el = vref.current;
    if (!el || item?.kind !== "video") return;
    if (live && !blank) { el.currentTime = 0; el.play().catch(() => {}); }
    else el.pause();
  }, [item?.id, live, blank]);

  const run = (cmd) => {
    onCmd(cmd);
    const el = vref.current;
    if (!el) return;
    if (cmd === "toggle") { if (el.paused) el.play().catch(() => {}); else el.pause(); }
    if (cmd === "restart") { el.currentTime = 0; el.play().catch(() => {}); }
  };

  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-500 text-sm leading-6">
        Choisis une photo ou une vidéo à gauche pour l'afficher à l'écran.<br />
        <span className="text-neutral-600">Les annonces temporaires s'effacent toutes seules après 3 jours ; les récurrentes (↻) restent.</span>
      </div>
    );
  }

  const st = item.kind === "video" && live && !blank ? STATUS[status] : null;

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl bg-black border border-neutral-700 overflow-hidden aspect-video flex items-center justify-center">
        {item.kind === "image" ? (
          <img src={item.url} alt="" className="max-w-full max-h-full object-contain" />
        ) : localErr ? (
          <p className="px-6 text-center text-sm text-red-300 leading-6">Ce navigateur ne sait pas lire cette vidéo (format ou codec).<br />Convertis-la en MP4 (H.264) puis ajoute-la de nouveau.</p>
        ) : (
          <video key={item.id} ref={vref} src={item.url} preload="metadata" muted playsInline onError={() => setLocalErr(true)} className="max-w-full max-h-full object-contain pointer-events-none" />
        )}
        <span className={`absolute top-2 left-3 text-xs ${blank ? "text-neutral-400" : live ? "text-green-400" : "text-neutral-500"}`}>
          {blank ? "● Écran noir" : live ? "● À l'écran" : "○ Pas à l'écran"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{item.kind === "video" ? "🎬 " : ""}{item.name}</div>
          <div className="text-xs text-neutral-500">{item.kind === "video" ? "Vidéo" : "Photo"}{item.keep ? ` · ↻ ${daysText(item.days)}` : ""}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button className={btn} disabled={!canStep} onClick={() => onStep(-1)}>← Préc.</button>
          <button className={btn} disabled={!canStep} onClick={() => onStep(1)}>Suiv. →</button>
        </div>
      </div>

      {item.kind === "video" && (
        <div>
          <div className="grid grid-cols-3 gap-1.5">
            <button className={btn} disabled={!live || !canProject} onClick={() => run("toggle")}>⏯ Lecture / Pause</button>
            <button className={btn} disabled={!live || !canProject} onClick={() => run("restart")}>⏮ Recommencer</button>
            <button className={btn} disabled={!live || !canProject} onClick={() => { onCmd(muted ? "unmute" : "mute"); setMuted(!muted); }}>{muted ? "🔊 Son" : "🔇 Couper le son"}</button>
          </div>
          {live && !blank && (
            <p className={`mt-2 text-xs leading-5 ${st ? st[0] : "text-neutral-500"}`}>
              {st ? st[1] : "En attente de l'écran de projection… Ouvre la page « Écran » (bouton jaune en haut) : la vidéo joue là-bas, l'aperçu ci-dessus est sans son."}
            </p>
          )}
          {!live && <p className="mt-2 text-xs text-neutral-500 leading-5">Clique la vidéo à gauche pour la lancer à l'écran. Elle joue sur la page « Écran » ; cet aperçu est sans son.</p>}
        </div>
      )}
    </div>
  );
}
