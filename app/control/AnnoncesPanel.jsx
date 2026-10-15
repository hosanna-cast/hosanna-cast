"use client";
import { useState } from "react";
import { timeLeft } from "@/lib/expiry";

// Annonces : photos et vidéos à afficher à l'écran. Effacées automatiquement après 3 jours.
export default function AnnoncesPanel({ ann, liveId, canProject, onProject }) {
  const { list, ready, error, busy, upload, remove } = ann;
  const [errs, setErrs] = useState([]);

  const onFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const copy = Array.from(files);
    e.target.value = "";
    setErrs(await upload(copy));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-neutral-400 font-medium">Photos et vidéos</span>
        <span className="text-[11px] text-neutral-500">effacées après 3 jours</span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          Annonces indisponibles : {error}<br />
          <span className="text-red-300/70">Exécute le fichier <b>supabase/temporaire.sql</b> dans Supabase (SQL Editor).</span>
        </p>
      )}

      <label className={`block w-full mb-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-center text-sm font-medium transition duration-100 active:scale-95 cursor-pointer ${error || busy ? "opacity-50 pointer-events-none" : ""}`}>
        {busy ? "Envoi en cours… (une vidéo peut prendre un moment)" : "+ Ajouter photos ou vidéos"}
        <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={onFiles} className="hidden" />
      </label>
      <p className="text-[11px] text-neutral-500 mb-2 leading-4">Vidéos : 50 Mo maximum chacune. Les photos sont réduites automatiquement.</p>

      {errs.length > 0 && (
        <div className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          {errs.map((m, i) => <p key={i}>{m}</p>)}
          <button onClick={() => setErrs([])} className="mt-1 text-red-300/70 underline">Fermer</button>
        </div>
      )}

      {!ready ? null : !list.length ? (
        <p className="text-sm text-neutral-500 mt-3">Aucune annonce pour l'instant. Utilise le bouton ci-dessus pour ajouter une photo ou une vidéo.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {list.map((a) => {
            const live = liveId === a.id;
            return (
              <li key={a.id} className={`relative rounded-lg overflow-hidden border-2 ${live ? "border-green-500" : "border-transparent"} bg-neutral-800`}>
                <button disabled={!canProject} onClick={() => onProject(a)} title={canProject ? "Afficher à l'écran" : ""}
                  className="block w-full text-left transition duration-100 active:scale-[0.97] disabled:cursor-default">
                  <div className="aspect-video bg-black flex items-center justify-center">
                    {a.kind === "image"
                      ? <img src={a.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />}
                  </div>
                  <div className="px-2 py-1.5">
                    <span className="block text-xs font-medium truncate">{a.kind === "video" ? "🎬 " : ""}{a.name}</span>
                    <span className="block text-[11px] text-neutral-500">s'efface dans {timeLeft(a.expires_at)}</span>
                  </div>
                </button>
                {live && <span className="absolute top-1 left-1 rounded bg-green-600 text-white text-[10px] px-1.5 py-0.5">À l'écran</span>}
                <button onClick={() => { if (window.confirm(`Supprimer « ${a.name} » ?`)) remove(a.id); }} aria-label="Supprimer"
                  className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 hover:bg-red-600 text-white text-xs">✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
