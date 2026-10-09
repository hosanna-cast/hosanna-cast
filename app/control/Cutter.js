"use client";

// diapositives <-> lignes avec coupures (cut = coupure après cette ligne)
export const linesFromSlides = (slides) =>
  slides.flatMap((s, si) => {
    const ls = s.split("\n").map((t) => t.trim()).filter(Boolean);
    return ls.map((t, li) => ({ t, cut: li === ls.length - 1 && si < slides.length - 1 }));
  });

export const slidesFromLines = (lines) => {
  const out = [];
  let cur = [];
  lines.forEach((l) => { cur.push(l.t); if (l.cut) { out.push(cur.join("\n")); cur = []; } });
  if (cur.length) out.push(cur.join("\n"));
  return out;
};

// Toutes les lignes du chant ; un clic entre deux lignes ajoute ou retire une coupure.
export default function Cutter({ lines, onToggle }) {
  return (
    <div className="max-w-xl mx-auto">
      {lines.map((l, i) => (
        <div key={i}>
          <div className="text-center font-semibold leading-snug py-0.5">{l.t}</div>
          {i < lines.length - 1 && (
            <button onClick={() => onToggle(i)}
              className={`group w-full flex items-center gap-2 py-1.5 sm:py-0.5 text-xs sm:text-[11px] transition duration-100 ${l.cut ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"}`}>
              <span className={`flex-1 border-t ${l.cut ? "border-dashed border-amber-400" : "border-dashed border-neutral-700 group-hover:border-amber-400/60"}`} />
              {l.cut ? "✂ coupure (retirer)" : "✂ couper ici"}
              <span className={`flex-1 border-t ${l.cut ? "border-dashed border-amber-400" : "border-dashed border-neutral-700 group-hover:border-amber-400/60"}`} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
