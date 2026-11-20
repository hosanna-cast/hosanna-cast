"use client";
import { useState } from "react";
import { frDate, nextSunday } from "@/lib/servicePlan";

const ICON = { verse: "📖", chants: "🎵", notes: "📝", media: "🖼️", text: "💬" };
const STATUS = {
  saved: ["text-neutral-500", "Enregistré"],
  saving: ["text-amber-300", "Enregistrement…"],
  error: ["text-red-400", "Non enregistré : nouvel essai…"],
  conflict: ["text-sky-300", "Modifié ailleurs : version rechargée"],
};

const small = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";
const input = "rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-amber-400";

// Plan de culte : l'ordre du service, préparé avant et déroulé avec « Suivant » (Page ↓ au clavier).
// Enregistré dans Supabase et partagé en direct entre tous les appareils de l'église.
export default function PlanCulte({ plan, activeItemId, canProject, readOnly, lib, missing, onPlay, onNext, onPrev, onAddRef, onAddLib, onAddCurrent, canAddCurrent }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState(null);          // null | "ref" | "lib" | "text" | "new" | "edit"
  const [val, setVal] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState("");
  const { items, active, plans } = plan;
  const idx = items.findIndex((x) => x.id === activeItemId);
  const [stCls, stTxt] = STATUS[plan.status] || STATUS.saved;

  const reset = () => { setMode(null); setVal(""); setDate(""); setErr(""); };

  const submit = (e) => {
    e.preventDefault();
    if (mode === "new") { plan.create(val || "Culte", date); return reset(); }
    if (mode === "edit") { plan.rename(active.id, val.trim() || active.name, date); return reset(); }
    if (!val.trim()) return;
    if (mode === "ref") { if (!onAddRef(val)) return setErr("Verset introuvable (ex. Jean 3:16)"); }
    if (mode === "text") plan.add({ k: "text", title: val.trim().split("\n")[0].slice(0, 60), text: val.trim() });
    reset();
  };

  return (
    <section className="mt-3 lg:mt-4 rounded-xl border border-neutral-700 bg-neutral-900">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left" aria-expanded={open}>
        <span className="text-sm font-medium min-w-0 truncate">
          Plan du culte <span className="text-neutral-500 font-normal">· {active ? `${active.name} · ${items.length}` : "aucun"}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {active && <span className={`text-[11px] ${stCls}`} role="status">{stTxt}</span>}
          <span className="text-neutral-400 text-xs">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          {!plan.ready && <p className="px-1 py-2 text-xs text-neutral-500">Chargement du plan…</p>}
          {plan.ready && plan.error && !plans.length && (
            <p className="px-1 py-2 text-xs text-red-300 leading-5">Plan indisponible : {plan.error}. Le SQL « plan-culte.sql » a-t-il été exécuté dans Supabase ?</p>
          )}

          {plan.ready && (
            <div className="flex items-center gap-1.5 mb-2">
              <select value={plan.activeId || ""} onChange={(e) => plan.setActiveId(e.target.value)} disabled={!plans.length} aria-label="Plan du culte"
                className={input + " flex-1 min-w-0 py-1 text-xs"}>
                {!plans.length && <option value="">Aucun plan</option>}
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.service_date ? ` · ${frDate(p.service_date)}` : ""}</option>)}
              </select>
              {!readOnly && <button className={small} onClick={() => { setMode("new"); setVal(""); setDate(nextSunday()); }} title="Nouveau plan">＋ Plan</button>}
              {!readOnly && active && <button className={small} onClick={() => { setMode("edit"); setVal(active.name); setDate(active.service_date || ""); }} aria-label="Renommer ce plan" title="Renommer / changer la date">✎</button>}
            </div>
          )}

          {(mode === "new" || mode === "edit") && (
            <form onSubmit={submit} className="mb-2 flex flex-col gap-1.5">
              <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nom (ex. Culte du dimanche)" className={input} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Date du culte" />
              <div className="flex gap-1.5">
                <button className="flex-1 rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 active:scale-95">{mode === "new" ? "Créer" : "Enregistrer"}</button>
                <button type="button" className={small} onClick={reset}>Annuler</button>
              </div>
            </form>
          )}

          {plan.ready && !plans.length && !readOnly && mode !== "new" && (
            <p className="px-1 py-2 text-xs text-neutral-500 leading-5">Crée un plan pour préparer l'ordre du culte : versets, chants, notes, annonces. Il sera partagé avec tous les appareils de l'équipe.</p>
          )}
          {plan.ready && !plans.length && readOnly && (
            <p className="px-1 py-2 text-xs text-neutral-500 leading-5">Aucun plan pour l'instant : l'administrateur ou l'aide écran peut en préparer un.</p>
          )}

          {active && items.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button className={small + " py-1.5"} disabled={!canProject || idx <= 0} onClick={onPrev}>⏮ Élément préc.</button>
              <button className="rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                disabled={!canProject || idx >= items.length - 1} onClick={onNext}>{idx < 0 ? "▶ Démarrer" : "Élément suiv. ⏭"}</button>
            </div>
          )}

          {active && items.length === 0 && !readOnly && (
            <p className="px-1 py-2 text-xs text-neutral-500 leading-5">Plan vide : ajoute versets, chants, notes ou annonces, puis avance avec « Suivant » (ou la touche <b className="text-neutral-300">Page ↓</b>).</p>
          )}

          <ol className="max-h-64 overflow-y-auto space-y-1">
            {items.map((it, i) => {
              const on = it.id === activeItemId;
              const gone = missing(it);
              return (
                <li key={it.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${on ? "bg-amber-400 text-black" : "bg-neutral-800"}`}>
                  <button disabled={!canProject || gone} onClick={() => onPlay(it)} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:cursor-default" title={gone ? "Cet élément n'existe plus" : "Projeter"}>
                    <span className={`text-xs w-4 text-center ${on ? "text-black/60" : "text-neutral-500"}`}>{i + 1}</span>
                    <span className="shrink-0">{ICON[it.k] || "•"}</span>
                    <span className={`truncate ${gone ? "line-through opacity-60" : ""}`}>{it.title}</span>
                    {gone && <span className="shrink-0 text-xs" aria-label="Élément supprimé">⚠</span>}
                  </button>
                  {!readOnly && (
                    <span className={`flex items-center gap-0.5 ${on ? "" : "opacity-60 group-hover:opacity-100"}`}>
                      <button onClick={() => plan.move(it.id, -1)} disabled={i === 0} aria-label="Monter" className="px-1 text-xs disabled:opacity-20">↑</button>
                      <button onClick={() => plan.move(it.id, 1)} disabled={i === items.length - 1} aria-label="Descendre" className="px-1 text-xs disabled:opacity-20">↓</button>
                      <button onClick={() => plan.removeItem(it.id)} aria-label="Retirer" className="px-1 text-xs hover:text-red-500">✕</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {active && !readOnly && mode === null && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className={small} onClick={() => setMode("ref")}>＋ Verset</button>
              <button className={small} onClick={() => setMode("lib")}>＋ Chant / note / annonce</button>
              <button className={small} onClick={() => setMode("text")}>＋ Texte</button>
              <button className={small} disabled={!canAddCurrent} onClick={onAddCurrent} title="Ajouter ce qui est à l'écran">＋ À l'écran</button>
              <span className="ml-auto flex gap-1.5">
                <button className={small + " text-neutral-400"} onClick={() => plan.duplicate(active.id)} title="Copier ce plan (pour le culte suivant)">Dupliquer</button>
                {items.length > 0 && <button className={small + " text-neutral-400"} onClick={() => { if (confirm("Vider ce plan ?")) plan.clear(); }}>Vider</button>}
                <button className={small + " text-neutral-400"} onClick={() => { if (confirm(`Supprimer le plan « ${active.name} » ?`)) plan.remove(active.id); }}>Supprimer</button>
              </span>
            </div>
          )}

          {(mode === "ref" || mode === "text") && (
            <form onSubmit={submit} className="mt-2 flex flex-col gap-1.5">
              {mode === "ref"
                ? <input autoFocus value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} placeholder="Ex. Jean 3:16 ou Rom 8 28-30" className={input} />
                : <textarea autoFocus rows={3} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Texte projeté tel quel (annonce, consigne…)" className={input} />}
              {err && <span className="text-xs text-red-400">{err}</span>}
              <div className="flex gap-1.5">
                <button className="flex-1 rounded-md bg-amber-400 text-black font-medium text-xs py-1.5 active:scale-95">Ajouter</button>
                <button type="button" className={small} onClick={reset}>Annuler</button>
              </div>
            </form>
          )}

          {mode === "lib" && (
            <div className="mt-2 flex flex-col gap-1.5">
              <select autoFocus defaultValue="" onChange={(e) => { if (!e.target.value) return; const [kind, id] = e.target.value.split("|"); onAddLib(kind, id); reset(); }} className={input}>
                <option value="">Choisir…</option>
                {lib.chants.length > 0 && <optgroup label="Chants">{lib.chants.map((x) => <option key={x.id} value={`chants|${x.id}`}>{x.title}</option>)}</optgroup>}
                {lib.notes.length > 0 && <optgroup label="Notes">{lib.notes.map((x) => <option key={x.id} value={`notes|${x.id}`}>{x.title}</option>)}</optgroup>}
                {lib.media.length > 0 && <optgroup label="Annonces">{lib.media.map((x) => <option key={x.id} value={`media|${x.id}`}>{x.name}</option>)}</optgroup>}
              </select>
              <button type="button" className={small} onClick={reset}>Annuler</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
