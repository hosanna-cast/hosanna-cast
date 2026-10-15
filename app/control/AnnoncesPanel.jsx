"use client";
import { Fragment, useState } from "react";
import { timeLeft, DAY_ORDER, DAY_SHORT, daysText } from "@/lib/expiry";

const today = () => new Date().getDay();

function DaysPicker({ days, onChange }) {
  const toggle = (d) => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
  return (
    <div className="flex flex-wrap gap-1">
      {DAY_ORDER.map((d) => (
        <button key={d} type="button" onClick={() => toggle(d)}
          className={`px-2 py-1 rounded-md text-xs transition duration-100 active:scale-90 ${days.includes(d) ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}>{DAY_SHORT[d]}</button>
      ))}
    </div>
  );
}

function Tile({ a, live, canProject, onProject, onEdit, onDelete }) {
  const isToday = a.keep && a.days.includes(today());
  return (
    <li className={`relative rounded-lg overflow-hidden border-2 ${live ? "border-green-500" : isToday ? "border-amber-400" : "border-transparent"} bg-neutral-800`}>
      <button disabled={!canProject} onClick={() => onProject(a)} title={canProject ? "Afficher à l'écran" : ""}
        className="block w-full text-left transition duration-100 active:scale-[0.97] disabled:cursor-default">
        <div className="aspect-video bg-black flex items-center justify-center">
          {a.kind === "image"
            ? <img src={a.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />}
        </div>
        <div className="px-2 py-1.5">
          <span className="block text-xs font-medium truncate">{a.kind === "video" ? "🎬 " : ""}{a.name}</span>
          <span className="block text-[11px] text-neutral-500 truncate">{a.keep ? `↻ ${daysText(a.days)}` : `s'efface dans ${timeLeft(a.expires_at)}`}</span>
        </div>
      </button>
      {live && <span className="absolute top-1 left-1 rounded bg-green-600 text-white text-[10px] px-1.5 py-0.5">À l'écran</span>}
      {!live && isToday && <span className="absolute top-1 left-1 rounded bg-amber-400 text-black text-[10px] font-medium px-1.5 py-0.5">Aujourd'hui</span>}
      <button onClick={() => onDelete(a)} aria-label="Supprimer" className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 hover:bg-red-600 text-white text-xs">✕</button>
      <button onClick={() => onEdit(a)} aria-label="Récurrence" title="Annonce récurrente"
        className={`absolute top-1 right-8 w-6 h-6 rounded text-xs ${a.keep ? "bg-amber-400 text-black" : "bg-black/60 hover:bg-amber-400 hover:text-black text-white"}`}>↻</button>
    </li>
  );
}

// Annonces : photos et vidéos à afficher à l'écran.
// Temporaires : effacées après 3 jours. Récurrentes (ex. temps de prière chaque mardi) : gardées, avec des jours facultatifs.
export default function AnnoncesPanel({ ann, liveId, canProject, onProject }) {
  const { list, ready, error, busy, upload, update, remove } = ann;
  const [errs, setErrs] = useState([]);
  const [rec, setRec] = useState({ keep: false, days: [] });      // réglage appliqué aux prochains envois
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ keep: false, days: [] });

  const onFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const copy = Array.from(files);
    e.target.value = "";
    setErrs(await upload(copy, rec));
  };
  const edit = (a) => {
    if (editId === a.id) return setEditId(null);
    setDraft({ keep: a.keep, days: a.days });
    setEditId(a.id);
  };
  const del = (a) => { if (window.confirm(`Supprimer « ${a.name} » ?`)) remove(a.id); };
  const save = async (a) => {
    const m = await update(a.id, draft);
    if (m) setErrs([`${a.name} : ${m}`]);
    setEditId(null);
  };

  const t = today();
  const recurring = list.filter((a) => a.keep).sort((a, b) => Number(b.days.includes(t)) - Number(a.days.includes(t)));
  const temp = list.filter((a) => !a.keep);

  const grid = (items) => (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((a) => (
        <Fragment key={a.id}>
          <Tile a={a} live={liveId === a.id} canProject={canProject} onProject={onProject} onEdit={edit} onDelete={del} />
          {editId === a.id && (
            <li className="col-span-2 rounded-lg border border-amber-400/40 bg-neutral-900 p-2.5 space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={draft.keep} onChange={(e) => setDraft({ ...draft, keep: e.target.checked })} className="mt-1 accent-amber-400" />
                <span>Annonce récurrente<span className="block text-xs text-neutral-500">Gardée : elle ne s'efface pas après 3 jours.</span></span>
              </label>
              {draft.keep ? (
                <>
                  <p className="text-xs text-neutral-400">Jours habituels (facultatif) : elle est mise en avant ces jours-là.</p>
                  <DaysPicker days={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
                </>
              ) : (
                <p className="text-xs text-neutral-500">Elle s'effacera 3 jours à partir de maintenant.</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setEditId(null)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 py-1.5 text-sm active:scale-95">Annuler</button>
                <button onClick={() => save(a)} className="rounded-lg bg-amber-400 text-black font-medium py-1.5 text-sm active:scale-95">Enregistrer</button>
              </div>
            </li>
          )}
        </Fragment>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-neutral-400 font-medium">Photos et vidéos</span>
        <span className="text-[11px] text-neutral-500">effacées après 3 jours</span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          Annonces indisponibles : {error}<br />
          <span className="text-red-300/70">Exécute (ou relance) le fichier <b>supabase/temporaire.sql</b> dans Supabase (SQL Editor).</span>
        </p>
      )}

      <div className="rounded-lg border border-neutral-700 p-2 mb-2 space-y-2">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={rec.keep} onChange={(e) => setRec({ ...rec, keep: e.target.checked })} className="mt-1 accent-amber-400" />
          <span>↻ Annonce récurrente<span className="block text-xs text-neutral-500">Pour une annonce qui revient (temps de prière…) : elle est gardée.</span></span>
        </label>
        {rec.keep && (
          <div>
            <p className="text-xs text-neutral-400 mb-1">Jours habituels (facultatif)</p>
            <DaysPicker days={rec.days} onChange={(days) => setRec({ ...rec, days })} />
          </div>
        )}
        <label className={`block w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-center text-sm font-medium transition duration-100 active:scale-95 cursor-pointer ${error || busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? "Envoi en cours… (une vidéo peut prendre un moment)" : "+ Ajouter photos ou vidéos"}
          <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" onChange={onFiles} className="hidden" />
        </label>
        <p className="text-[11px] text-neutral-500 leading-4">Vidéos : MP4 (H.264), 50 Mo maximum chacune. Les photos sont réduites automatiquement.</p>
      </div>

      {errs.length > 0 && (
        <div className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          {errs.map((m, i) => <p key={i}>{m}</p>)}
          <button onClick={() => setErrs([])} className="mt-1 text-red-300/70 underline">Fermer</button>
        </div>
      )}

      {!ready ? null : !list.length ? (
        <p className="text-sm text-neutral-500 mt-3">Aucune annonce pour l'instant. Utilise le bouton ci-dessus pour ajouter une photo ou une vidéo.</p>
      ) : (
        <>
          {recurring.length > 0 && (
            <>
              <div className="text-[11px] text-neutral-500 mt-3 mb-1.5">↻ Récurrentes</div>
              {grid(recurring)}
            </>
          )}
          {temp.length > 0 && (
            <>
              <div className="text-[11px] text-neutral-500 mt-3 mb-1.5">Temporaires (3 jours)</div>
              {grid(temp)}
            </>
          )}
        </>
      )}
    </div>
  );
}
