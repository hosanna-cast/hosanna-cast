"use client";
import { useEffect, useRef } from "react";

// Le chapitre complet du verset projeté : le verset à l'écran est en vert, les versets cités dans la note en bleu.
// L'orateur peut dire « reviens 3 versets avant » : un clic sur n'importe quel verset le projette.
export default function ChapterView({ verses, title, label, chapter, chapterCount, live, cite, onPick, onChapter }) {
  const box = useRef(null);

  useEffect(() => {
    const ul = box.current;
    if (live == null || !ul) return;
    const el = ul.querySelector(`[data-v="${live}"]`);
    if (!el) return;
    // positions réelles à l'écran (offsetTop était faux : la liste n'est pas le parent positionné)
    const u = ul.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const margin = 8;
    const visible = r.top >= u.top + margin && r.bottom <= u.bottom - margin;
    if (visible) return; // déjà visible : on ne bouge pas la liste
    const top = ul.scrollTop + (r.top - u.top) - (ul.clientHeight - el.clientHeight) / 2;
    ul.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [live, title, chapter]);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm min-w-0">
          <span className="font-semibold text-base">{title} {chapter + 1}</span>
          <span className="text-neutral-500 text-xs ml-2">{label}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button disabled={chapter === 0} onClick={() => onChapter(-1)}
            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm disabled:opacity-30 transition duration-100 active:scale-95">‹ {chapter}</button>
          <button disabled={chapter >= chapterCount - 1} onClick={() => onChapter(1)}
            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm disabled:opacity-30 transition duration-100 active:scale-95">{chapter + 2} ›</button>
        </div>
      </div>
      <p className="text-[11px] text-neutral-500 mb-2">Clic = projeter ce verset · Maj+clic = plusieurs versets</p>
      <ul ref={box} className="relative space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 scroll-py-4">
        {verses.map((t, v) => {
          const isLive = live === v;
          const cited = cite && v >= cite.v && v <= cite.vEnd;
          return (
            <li key={v} data-v={v} onClick={(e) => onPick(v, e)}
              className={`px-3 py-2 rounded-lg cursor-pointer select-none leading-snug transition duration-100 active:scale-[0.99] ${isLive ? "bg-green-600 text-white" : cited ? "bg-blue-400/10 border-l-2 border-blue-400 text-neutral-100 hover:bg-blue-400/20" : "text-neutral-300 hover:bg-neutral-800"}`}>
              <b className={`mr-2 font-medium ${isLive ? "text-green-100" : cited ? "text-blue-300" : "text-neutral-500"}`}>{v + 1}</b>
              {t}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
