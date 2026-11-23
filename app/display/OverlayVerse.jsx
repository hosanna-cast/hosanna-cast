"use client";
import { useMemo, useState } from "react";
import { parseRef } from "@/lib/parseRef";

// Quand une image est à l'écran : ajouter un verset par-dessus (par référence : jn 3 16), ou le retirer.
export default function OverlayVerse({ bible, refOf, textOf, overlay, onPick, onClear, disabled }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const ref = bible && q.trim() ? parseRef(q) : null;
    if (!ref) return [];
    return ref.books.slice(0, 4).map((b) => {
      const c = ref.chapter ? ref.chapter - 1 : 0;
      const v = ref.verse ? ref.verse - 1 : 0;
      if (bible[b]?.[c]?.[v] === undefined) return null;
      return { b, c, v, vEnd: ref.verseEnd ? ref.verseEnd - 1 : null };
    }).filter(Boolean);
  }, [q, bible]);

  const pick = (r) => { onPick(r); setQ(""); };

  return (
    <div className="mt-2 lg:mt-3 rounded-lg border border-neutral-700 bg-neutral-800/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-amber-300">Verset sur l'image</span>
        {overlay && (
          <button onClick={onClear} disabled={disabled} className="rounded-md bg-neutral-700 hover:bg-red-600 px-2 py-0.5 text-xs transition duration-100 active:scale-95 disabled:opacity-40">Retirer</button>
        )}
      </div>
      {overlay && <p className="text-xs text-green-400 truncate">● À l'écran : {overlay.ref}</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled || !bible}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { e.preventDefault(); pick(results[0]); } e.stopPropagation(); }}
        placeholder={bible ? "jn 3 16" : "Chargement de la Bible…"}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm outline-none focus:ring-2 ring-amber-400 disabled:opacity-40" />
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={`${r.b}-${r.c}-${r.v}`}>
              <button onClick={() => pick(r)} disabled={disabled}
                className="w-full text-left rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 text-xs transition duration-100 active:scale-[0.98] disabled:opacity-40">
                <span className="font-medium text-amber-300">{refOf(r)}</span>
                <span className="block text-neutral-300 line-clamp-2">{textOf(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!overlay && !q.trim() && <p className="text-[11px] text-neutral-400 leading-4">Tape une référence, puis clique le verset : il s'affiche sur l'image.</p>}
    </div>
  );
}
