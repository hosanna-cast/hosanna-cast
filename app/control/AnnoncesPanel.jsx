"use client";
import { Fragment, useState } from "react";
import { timeLeft, DAY_ORDER, DAY_SHORT, runsToday, toInputDate, todayInput, TYPES, TYPE_IDS, typeOf, optsOf, daysText, specialText } from "@/lib/expiry";

// couleur de chaque section (titre + raccourci)
const SEC = {
  regular: { text: "text-sky-300", chip: "bg-sky-400/15 text-sky-300 hover:bg-sky-400/25", line: "border-sky-400/30" },
  special: { text: "text-amber-300", chip: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25", line: "border-amber-400/30" },
  oneoff:  { text: "text-emerald-300", chip: "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25", line: "border-emerald-400/30" },
};
const goSection = (t) => document.getElementById(`ann-sec-${t}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

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
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {a.kind === "image"
            ? <img src={a.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pt-5 pb-1">
          <span className="block text-xs font-medium truncate">{a.kind === "video" ? "🎬 " : ""}{a.name}</span>
          <span className="block text-[11px] text-white/90 truncate">{{ regular: `↻ ${daysText(a.days)}`, special: `★ ${specialText(a)}`, oneoff: `s'efface dans ${timeLeft(a.expires_at)}` }[typeOf(a)]}</span>
          </div>
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
// État partagé entre le formulaire d'ajout (colonne de gauche) et la grille (centre)
export function useAnnoncesUi(ann) {
  const { upload, update, replace, remove, busy } = ann;
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

  return { errs, setErrs, rec, setRec, editId, setEditId, draft, setDraft, onFiles, edit, del, save, onReplace, busy };
}

// Colonne de gauche : ajout d'une annonce
export function AnnoncesAdd({ ann, ui }) {
  const { error } = ann;
  const { rec, setRec, onFiles, busy } = ui;
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-xs text-white font-medium">Ajouter une annonce</span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          Annonces indisponibles : {error}<br />
          <span className="text-red-300/70">Exécute (ou relance) le fichier <b>supabase/temporaire.sql</b> dans Supabase (SQL Editor).</span>
        </p>
      )}

      <div className="rounded-lg border border-neutral-700 p-2 space-y-2">
        <p className="text-xs text-white">Type de la prochaine annonce</p>
        <TypePicker value={rec.type} onChange={(type) => setRec({ ...rec, type })} />
        <TypeFields v={rec} onChange={setRec} />
        <label className={`block w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 py-2 text-center text-sm font-medium transition duration-100 active:scale-95 cursor-pointer ${error || busy || (rec.type === "special" && !rec.until) ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? "Envoi en cours… (une vidéo peut prendre un moment)" : "+ Ajouter photos ou vidéos"}
          <input type="file" multiple accept={ACCEPT} onChange={onFiles} className="hidden" />
        </label>
        <p className="text-[11px] text-white leading-4">Vidéos : MP4 (H.264), 50 Mo maximum chacune. Les photos sont réduites automatiquement.</p>
      </div>
    </div>
  );
}

// Centre : toutes les annonces en grille (la vignette verte est celle qui est à l'écran)
export function AnnoncesGrid({ ann, ui, liveId, canProject, onProject }) {
  const { list, ready } = ann;
  const { errs, setErrs, editId, setEditId, draft, setDraft, onReplace, edit, del, save, busy } = ui;
  const sections = TYPE_IDS.map((t) => ({ t, items: list.filter((a) => typeOf(a) === t) }));

  // ordinateur : le formulaire d'ajout est la 1re case de la grille (coin gauche) ; les images se placent autour et en dessous
  const firstIdx = sections.findIndex((x) => x.items.length > 0);
  const addCell = (
    <li className="hidden lg:block lg:col-span-2 lg:row-span-3 rounded-lg border border-neutral-700 bg-neutral-800/60 p-2.5 self-start">
      <AnnoncesAdd ann={ann} ui={ui} />
    </li>
  );
  const grid = (items, withAdd) => (
    <ul className="grid gap-2 sm:gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
      {withAdd && addCell}
      {items.map((a) => (
        <Fragment key={a.id}>
          <Tile a={a} live={liveId === a.id} canProject={canProject} onProject={onProject} onEdit={edit} onDelete={del} />
          {editId === a.id && (
            <li className="col-span-full rounded-lg border border-amber-400/40 bg-neutral-900 p-2.5 space-y-2.5">
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
      {errs.length > 0 && (
        <div className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">
          {errs.map((m, i) => <p key={i}>{m}</p>)}
          <button onClick={() => setErrs([])} className="mt-1 text-red-300/70 underline">Fermer</button>
        </div>
      )}

      {!ready ? null : !list.length ? (
        <div className="mt-1">
          <div className="hidden lg:block max-w-sm rounded-lg border border-neutral-700 bg-neutral-800/60 p-2.5 mb-3"><AnnoncesAdd ann={ann} ui={ui} /></div>
          <p className="text-sm text-neutral-300">Aucune annonce pour l'instant. Utilise le bouton « Ajouter photos ou vidéos ».</p>
        </div>
      ) : (
        <>
          <nav aria-label="Sections des annonces" className="flex flex-wrap gap-1.5 mb-3">
            {sections.map(({ t, items }) => (
              <button key={t} onClick={() => goSection(t)} disabled={!items.length}
                className={`rounded-full px-3 py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${SEC[t].chip}`}>
                {TYPES[t].short} <span className="opacity-70">({items.length})</span>
              </button>
            ))}
          </nav>
          {sections.map(({ t, items }, si) => items.length > 0 && (
            <div key={t} id={`ann-sec-${t}`} className="scroll-mt-4 mb-4 last:mb-0">
              <div className={`text-sm font-semibold mb-2 pb-1 border-b ${SEC[t].text} ${SEC[t].line}`}>{TYPES[t].short} <span className="font-normal opacity-70 text-sm">({items.length})</span></div>
              {grid(items, si === firstIdx)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
