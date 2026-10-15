"use client";
import { Fragment, useState } from "react";
import { timeLeft, DAY_ORDER, DAY_SHORT, runsToday, toInputDate, todayInput, TYPES, TYPE_IDS, typeOf, optsOf, daysText, specialText } from "@/lib/expiry";

const ACCEPT = "image/*,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov";

function DaysPicker({ days, onChange }) {
  const toggle = (d) => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
  return (
    <div className="flex flex-wrap gap-1">
      {DAY_ORDER.map((d) => (
        <button key={d} type="button" onClick={() => toggle(d)}
          className={`px-2 py-1 rounded-md text-xs transition duration-100 active:scale-90 ${days.includes(d) ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 text-white hover:bg-neutral-700"}`}>{DAY_SHORT[d]}</button>
      ))}
    </div>
  );
}

// Choix du type d'annonce : un seul choix clair à la place de la case « récurrente »
function TypePicker({ value, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-1">
        {TYPE_IDS.map((t) => (
          <button key={t} type="button" onClick={() => onChange(t)}
            className={`rounded-md px-1 py-1.5 text-xs transition duration-100 active:scale-95 ${value === t ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 text-white hover:bg-neutral-700"}`}>{TYPES[t].label}</button>
        ))}
      </div>
      <p className="text-[11px] text-white mt-1 leading-4">{TYPES[value].hint}</p>
    </div>
  );
}

// Champs qui changent selon le type : jours (Régulière, Temps spécial), date de l'événement (Temps spécial)
function TypeFields({ v, onChange }) {
  if (v.type === "oneoff") return null;
  return (
    <>
      <div>
        <p className="text-xs text-white mb-1">Jours{v.type === "special" ? " (facultatif, ex. chaque dimanche)" : " habituels (facultatif)"} : mise en avant ces jours-là.</p>
        <DaysPicker days={v.days} onChange={(days) => onChange({ ...v, days })} />
      </div>
      {v.type === "special" && (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white">Date de l'événement</span>
            <input type="date" min={todayInput()} value={v.until || ""} onChange={(e) => onChange({ ...v, until: e.target.value })}
              className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs [color-scheme:dark]" />
          </div>
          <p className="text-[11px] text-white mt-1 leading-4">Obligatoire. L'annonce reste affichée jusqu'à ce jour-là, puis disparaît le lendemain.</p>
        </div>
      )}
    </>
  );
}

function Tile({ a, live, canProject, onProject, onEdit, onDelete }) {
  const isToday = runsToday(a);
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
          <span className="block text-[11px] text-white truncate">{{ regular: `↻ ${daysText(a.days)}`, special: `★ ${specialText(a)}`, oneoff: `s'efface dans ${timeLeft(a.expires_at)}` }[typeOf(a)]}</span>
        </div>
      </button>
      {live && <span className="absolute top-1 left-1 rounded bg-green-600 text-white text-[10px] px-1.5 py-0.5">À l'écran</span>}
      {!live && isToday && <span className="absolute top-1 left-1 rounded bg-amber-400 text-black text-[10px] font-medium px-1.5 py-0.5">Aujourd'hui</span>}
      <button onClick={() => onDelete(a)} aria-label="Supprimer" className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 hover:bg-red-600 text-white text-xs">✕</button>
      <button onClick={() => onEdit(a)} aria-label="Modifier" title="Modifier l'annonce (nom, type, jours, date, photo)"
        className="absolute top-1 right-8 w-6 h-6 rounded text-xs bg-black/60 hover:bg-amber-400 hover:text-black text-white">✎</button>
    </li>
  );
}

// Annonces : photos et vidéos à afficher à l'écran, en trois sections :
//  Régulières (cellule, prière, culte…) : jamais effacées.
//  Temps spéciaux (convention, évangélisation…) : effacées après la date de l'événement.
//  Ponctuelles : effacées 3 jours après l'ajout.
export default function AnnoncesPanel({ ann, liveId, canProject, onProject }) {
  const { list, ready, error, busy, upload, update, replace, remove } = ann;
  const [errs, setErrs] = useState([]);
  const [rec, setRec] = useState({ type: "oneoff", days: [], until: "" });      // réglage appliqué aux prochains envois
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ type: "oneoff", days: [], until: "", name: "" });

  const onFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const copy = Array.from(files);
    e.target.value = "";
    if (rec.type === "special" && !rec.until) { setErrs(["Temps spécial : choisis d'abord la date de l'événement."]); return; }
    setErrs(await upload(copy, optsOf(rec)));
  };
  const edit = (a) => {
    if (editId === a.id) return setEditId(null);
    setDraft({ type: typeOf(a), days: a.days, until: typeOf(a) === "special" ? toInputDate(a.expires_at) : "", name: a.name });
    setEditId(a.id);
  };
  const del = (a) => { if (window.confirm(`Supprimer « ${a.name} » ?`)) remove(a.id); };
  const save = async (a) => {
    if (draft.type === "special" && !draft.until) { setErrs([`${a.name} : choisis la date de l'événement.`]); return; }
    const keepDate = draft.type === "special" && typeOf(a) === "special" && draft.until === toInputDate(a.expires_at);
    if (draft.type === "special" && !keepDate && draft.until < todayInput()) { setErrs([`${a.name} : la date de l'événement est déjà passée.`]); return; }
    const m = await update(a.id, { ...optsOf(draft), name: draft.name });
    if (m) setErrs([`${a.name} : ${m}`]);
    setEditId(null);
  };
  const onReplace = async (a, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const m = await replace(a.id, file);
    if (m) setErrs([`${a.name} : ${m}`]);
    else { setErrs([]); setEditId(null); }
  };

  const sections = TYPE_IDS.map((t) => ({ t, items: list.filter((a) => typeOf(a) === t) }));

  const grid = (items) => (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((a) => (
        <Fragment key={a.id}>
          <Tile a={a} live={liveId === a.id} canProject={canProject} onProject={onProject} onEdit={edit} onDelete={del} />
          {editId === a.id && (
            <li className="col-span-2 rounded-lg border border-amber-400/40 bg-neutral-900 p-2.5 space-y-2.5">
              <div>
                <p className="text-xs text-white mb-1">Nom</p>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80}
                  className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm" />
              </div>

              <TypePicker value={draft.type} onChange={(type) => setDraft({ ...draft, type })} />
              <TypeFields v={draft} onChange={setDraft} />
              {draft.type === "oneoff" && a.keep && <p className="text-xs text-white">Elle s'effacera 3 jours à partir de maintenant.</p>}

              <div className="border-t border-neutral-800 pt-2.5">
                <label className={`block w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-1.5 text-center text-sm transition duration-100 active:scale-95 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                  {busy ? "Envoi en cours…" : "Changer la photo / vidéo"}
                  <input type="file" accept={ACCEPT} onChange={(e) => onReplace(a, e)} className="hidden" />
                </label>
                <p className="text-[11px] text-white mt-1 leading-4">Seule l'image change : le nom, le type, les jours et la date sont gardés.</p>
              </div>

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
        <span className="text-xs text-white font-medium">Photos et vidéos</span>
        <span className="text-[11px] text-white">3 sections</span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          Annonces indisponibles : {error}<br />
          <span className="text-red-300/70">Exécute (ou relance) le fichier <b>supabase/temporaire.sql</b> dans Supabase (SQL Editor).</span>
        </p>
      )}

      <div className="rounded-lg border border-neutral-700 p-2 mb-2 space-y-2">
        <p className="text-xs text-white">Type de la prochaine annonce</p>
        <TypePicker value={rec.type} onChange={(type) => setRec({ ...rec, type })} />
        <TypeFields v={rec} onChange={setRec} />
        <label className={`block w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-center text-sm font-medium transition duration-100 active:scale-95 cursor-pointer ${error || busy || (rec.type === "special" && !rec.until) ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? "Envoi en cours… (une vidéo peut prendre un moment)" : "+ Ajouter photos ou vidéos"}
          <input type="file" multiple accept={ACCEPT} onChange={onFiles} className="hidden" />
        </label>
        <p className="text-[11px] text-white leading-4">Vidéos : MP4 (H.264), 50 Mo maximum chacune. Les photos sont réduites automatiquement.</p>
      </div>

      {errs.length > 0 && (
        <div className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          {errs.map((m, i) => <p key={i}>{m}</p>)}
          <button onClick={() => setErrs([])} className="mt-1 text-red-300/70 underline">Fermer</button>
        </div>
      )}

      {!ready ? null : !list.length ? (
        <p className="text-sm text-white mt-3">Aucune annonce pour l'instant. Utilise le bouton ci-dessus pour ajouter une photo ou une vidéo.</p>
      ) : (
        <>
          {sections.map(({ t, items }) => items.length > 0 && (
            <div key={t}>
              <div className="text-[11px] text-white font-medium mt-3 mb-1.5">{TYPES[t].short} <span className="text-white">({items.length})</span></div>
              {grid(items)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
