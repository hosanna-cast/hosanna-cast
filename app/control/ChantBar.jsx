"use client";

// Barre « chant en cours » (onglet Chants) : collée en haut du centre.
//  - ligne 1 : chant précédent / titre / chant suivant (dans la playlist active), puis couplet précédent / suivant
//  - ligne 2 : les chants de la playlist active en pastilles, un clic = on passe à ce chant
const nav = "rounded-md bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 text-sm transition duration-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

export default function ChantBar({ item, count, liveIndex, playlist, chants, selectedId, onPick, onStep, canStep }) {
  const ids = playlist?.chant_ids || [];
  const byId = new Map(chants.map((c) => [c.id, c]));
  const pos = ids.indexOf(selectedId);
  const goto = (d) => { const id = ids[pos + d]; if (id && byId.has(id)) onPick(id); };
  if (!item && !ids.length) return null;
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-2.5 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        {ids.length > 0 && <button className={nav} disabled={pos <= 0} onClick={() => goto(-1)} title="Chant précédent de la playlist">⏮</button>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{item ? item.title : "Aucun chant choisi"}</div>
          {item && <div className="text-[11px] text-neutral-500">{liveIndex != null ? `Couplet ${liveIndex + 1} / ${count}` : `${count} diapositive${count > 1 ? "s" : ""}`}{playlist ? ` · ${playlist.name}` : ""}</div>}
        </div>
        {ids.length > 0 && <button className={nav} disabled={pos < 0 || pos >= ids.length - 1} onClick={() => goto(1)} title="Chant suivant de la playlist">⏭</button>}
        <span className="mx-1 h-6 w-px bg-neutral-700" />
        <button className={nav} disabled={!canStep} onClick={() => onStep(-1)} title="Couplet précédent (←)">← Couplet</button>
        <button className={nav} disabled={!canStep} onClick={() => onStep(1)} title="Couplet suivant (→)">Couplet →</button>
      </div>
      {ids.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {ids.map((id, i) => {
            const c = byId.get(id);
            const on = id === selectedId;
            return (
              <button key={id + i} disabled={!c} onClick={() => onPick(id)} title={c?.title}
                className={`shrink-0 max-w-[14rem] truncate rounded-full border px-3 py-1 text-xs transition duration-100 active:scale-95 ${on ? "border-amber-400 bg-amber-400 text-black font-medium" : c ? "border-neutral-600 text-neutral-300 hover:bg-neutral-800" : "border-neutral-700 italic text-neutral-600"}`}>
                <span className="mr-1 opacity-60">{i + 1}</span>{c ? c.title : "(supprimé)"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
