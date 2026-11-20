"use client";
import { useEffect, useRef, useState } from "react";
import { frDate, nextSunday } from "@/lib/servicePlan";

const ICON = { verse: "📖", chants: "🎵", notes: "📝", media: "🖼️", text: "💬" };
const STATUS = {
  saved: ["text-neutral-500", "Enregistré"],
  saving: ["text-amber-300", "Enregistrement…"],
  error: ["text-red-400", "Non enregistré : nouvel essai…"],
  conflict: ["text-sky-300", "Modifié ailleurs : version rechargée"],
};

const small = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 text-xs transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";
const input = "w-full rounded-md bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400";
const primary = "rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 px-3 transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

// Plan de culte : l'ordre du service, préparé avant et déroulé avec « Suivant » (Page ↓ au clavier).
// Enregistré dans Supabase et partagé en direct entre tous les appareils de l'église.
// Onglet « Plan » : outils d'ajout dans le panneau de gauche (PlanAdd), la liste en grand au centre (PlanList).

// ───── gauche : ajouter un élément au plan ─────
export function PlanAdd({ plan, readOnly, lib, onAddRef, onAddLib, onAddCurrent, canAddCurrent }) {
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [txt, setTxt] = useState("");
  const [f, setF] = useState("");
  const { active } = plan;

  if (readOnly) {
    return <p className="text-sm text-neutral-300 leading-6">Le plan se prépare avec l'administrateur ou l'aide écran. Ici, tu peux le suivre au centre.</p>;
  }
  if (!active) {
    return <p className="text-sm text-neutral-300 leading-6">Crée ou choisis un plan au centre, puis ajoute ici versets, chants, notes, annonces ou texte.</p>;
  }

  const addRef = (e) => {
    e.preventDefault();
    if (!ref.trim()) return;
    if (!onAddRef(ref)) return setErr("Verset introuvable (ex. Jean 3:16)");
    setRef(""); setErr("");
  };
  const addTxt = (e) => {
    e.preventDefault();
    if (!txt.trim()) return;
    plan.add({ k: "text", title: txt.trim().split("\n")[0].slice(0, 60), text: txt.trim() });
    setTxt("");
  };

  const q = f.trim().toLowerCase();
  const groups = [
    ["chants", "Chants", lib.chants.map((x) => [x.id, x.title])],
    ["notes", "Notes", lib.notes.map((x) => [x.id, x.title])],
    ["media", "Annonces", lib.media.map((x) => [x.id, x.name])],
  ].map(([kind, label, rows]) => [kind, label, rows.filter(([, t]) => !q || String(t).toLowerCase().includes(q))]);

  return (
    <div className="space-y-4">
      <span className="block text-xs text-white font-medium">Ajouter au plan « {active.name} »</span>

      <form onSubmit={addRef} className="space-y-1.5">
        <label className="text-xs text-neutral-300">📖 Verset</label>
        <div className="flex gap-1.5">
          <input value={ref} onChange={(e) => { setRef(e.target.value); setErr(""); }} placeholder="Ex. Jean 3:16 ou Rom 8 28-30" className={input} />
          <button className={primary}>＋</button>
        </div>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </form>

      <form onSubmit={addTxt} className="space-y-1.5">
        <label className="text-xs text-neutral-300">💬 Texte libre</label>
        <textarea rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Texte projeté tel quel (consigne, annonce…)" className={input} />
        <button className={primary + " w-full"} disabled={!txt.trim()}>＋ Ajouter le texte</button>
      </form>

      <button className={small + " w-full"} disabled={!canAddCurrent} onClick={onAddCurrent} title="Ajouter ce qui est à l'écran">＋ Ce qui est à l'écran</button>

      <div className="space-y-2">
        <label className="text-xs text-neutral-300">🎵 📝 🖼️ Chants, notes, annonces</label>
        <input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filtrer…" className={input} />
        {groups.every(([, , rows]) => !rows.length) && <p className="text-xs text-neutral-500">{q ? "Aucun résultat." : "Rien dans la bibliothèque pour l'instant."}</p>}
        {groups.map(([kind, label, rows]) => rows.length > 0 && (
          <div key={kind}>
            <div className="text-[11px] text-neutral-500 mb-1">{label} ({rows.length})</div>
            <ul className="space-y-1">
              {rows.map(([id, title]) => (
                <li key={id}>
                  <button onClick={() => onAddLib(kind, id)} title="Ajouter au plan"
                    className="w-full flex items-center gap-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 text-sm text-left transition duration-100 active:scale-[0.98]">
                    <span className="shrink-0">{ICON[kind]}</span>
                    <span className="flex-1 min-w-0 truncate">{title}</span>
                    <span className="text-amber-400 shrink-0">＋</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── centre : le plan en grand ─────
export function PlanList({ plan, activeItemId, canProject, readOnly, missing, onPlay, onNext, onPrev }) {
  const [mode, setMode] = useState(null);          // null | "new" | "edit"
  const [val, setVal] = useState("");
  const [date, setDate] = useState("");
  const activeRow = useRef(null);
  const { items, active, plans } = plan;
  const idx = items.findIndex((x) => x.id === activeItemId);
  const [stCls, stTxt] = STATUS[plan.status] || STATUS.saved;

  useEffect(() => { activeRow.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeItemId]);

  const reset = () => { setMode(null); setVal(""); setDate(""); };
  const submit = (e) => {
    e.preventDefault();
    if (mode === "new") plan.create(val || "Culte", date);
    else if (mode === "edit") plan.rename(active.id, val.trim() || active.name, date);
    reset();
  };

  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 sm:p-4">
      {!plan.ready && <p className="text-sm text-neutral-500">Chargement du plan…</p>}
      {plan.ready && plan.error && !plans.length && (
        <p className="mb-2 rounded-lg bg-red-500/10 text-red-300 text-xs px-2.5 py-2 leading-5">Plan indisponible : {plan.error}. Le SQL « plan-culte.sql » a-t-il été exécuté dans Supabase ?</p>
      )}

      {plan.ready && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <select value={plan.activeId || ""} onChange={(e) => plan.setActiveId(e.target.value)} disabled={!plans.length} aria-label="Plan du culte"
            className={input + " flex-1 min-w-[10rem] !w-auto"}>
            {!plans.length && <option value="">Aucun plan</option>}
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.service_date ? ` · ${frDate(p.service_date)}` : ""}</option>)}
          </select>
          {!readOnly && <button className={small} onClick={() => { setMode("new"); setVal(""); setDate(nextSunday()); }}>＋ Plan</button>}
          {!readOnly && active && <button className={small} onClick={() => { setMode("edit"); setVal(active.name); setDate(active.service_date || ""); }} aria-label="Renommer ce plan" title="Renommer / changer la date">✎</button>}
          {active && <span className={`text-[11px] ${stCls}`} role="status">{stTxt}</span>}
        </div>
      )}

      {mode && (
        <form onSubmit={submit} className="mb-3 flex flex-col sm:flex-row gap-1.5">
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nom (ex. Culte du dimanche)" className={input} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input + " sm:w-44 [color-scheme:dark]"} aria-label="Date du culte" />
          <button className={primary}>{mode === "new" ? "Créer" : "Enregistrer"}</button>
          <button type="button" className={small} onClick={reset}>Annuler</button>
        </form>
      )}

      {plan.ready && !plans.length && !readOnly && !mode && (
        <p className="py-4 text-sm text-neutral-400 leading-6">Crée un plan pour préparer l'ordre du culte : versets, chants, notes, annonces. Il sera partagé avec tous les appareils de l'équipe.</p>
      )}
      {plan.ready && !plans.length && readOnly && (
        <p className="py-4 text-sm text-neutral-400 leading-6">Aucun plan pour l'instant : l'administrateur ou l'aide écran peut en préparer un.</p>
      )}

      {active && items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button className={small + " py-2 text-sm"} disabled={!canProject || idx <= 0} onClick={onPrev}>⏮ Élément précédent</button>
          <button className="rounded-md bg-amber-400 text-black font-medium text-sm py-2 transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            disabled={!canProject || idx >= items.length - 1} onClick={onNext}>{idx < 0 ? "▶ Démarrer" : "Élément suivant ⏭"}</button>
        </div>
      )}

      {active && items.length === 0 && (
        <p className="py-4 text-sm text-neutral-400 leading-6">
          Plan vide{readOnly ? "." : " : utilise les outils à gauche pour ajouter versets, chants, notes ou annonces, puis avance avec « Suivant » (ou la touche "}
          {!readOnly && <><b className="text-neutral-200">Page ↓</b>).</>}
        </p>
      )}

      <ol className="space-y-1.5">
        {items.map((it, i) => {
          const on = it.id === activeItemId;
          const gone = missing(it);
          return (
            <li key={it.id} ref={on ? activeRow : null} className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 ${on ? "bg-amber-400 text-black" : "bg-neutral-800"}`}>
              <button disabled={!canProject || gone} onClick={() => onPlay(it)} className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:cursor-default" title={gone ? "Cet élément n'existe plus" : "Projeter"}>
                <span className={`text-sm w-6 text-center shrink-0 ${on ? "text-black/60" : "text-neutral-500"}`}>{i + 1}</span>
                <span className="shrink-0 text-lg">{ICON[it.k] || "•"}</span>
                <span className={`truncate text-base ${gone ? "line-through opacity-60" : ""}`}>{it.title}</span>
                {gone && <span className="shrink-0" aria-label="Élément supprimé">⚠</span>}
              </button>
              {!readOnly && (
                <span className={`flex items-center gap-1 ${on ? "" : "opacity-60 group-hover:opacity-100"}`}>
                  <button onClick={() => plan.move(it.id, -1)} disabled={i === 0} aria-label="Monter" className="px-1.5 py-1 disabled:opacity-20">↑</button>
                  <button onClick={() => plan.move(it.id, 1)} disabled={i === items.length - 1} aria-label="Descendre" className="px-1.5 py-1 disabled:opacity-20">↓</button>
                  <button onClick={() => plan.removeItem(it.id)} aria-label="Retirer" className="px-1.5 py-1 hover:text-red-500">✕</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {active && !readOnly && (
        <div className="flex flex-wrap justify-end gap-1.5 mt-4 pt-3 border-t border-neutral-800">
          <button className={small + " text-neutral-400"} onClick={() => plan.duplicate(active.id)} title="Copier ce plan (pour le culte suivant)">Dupliquer</button>
          {items.length > 0 && <button className={small + " text-neutral-400"} onClick={() => { if (confirm("Vider ce plan ?")) plan.clear(); }}>Vider</button>}
          <button className={small + " text-neutral-400"} onClick={() => { if (confirm(`Supprimer le plan « ${active.name} » ?`)) plan.remove(active.id); }}>Supprimer</button>
        </div>
      )}
    </section>
  );
}
