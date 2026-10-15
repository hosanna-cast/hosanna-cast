"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openScreen } from "@/lib/screen";

// Vue orateur (écran de la chaire / tablette) : /speaker?k=<jeton>
// Montre ce qui est projeté, ce qui vient ensuite, et un chronomètre de prédication.
// Elle ne pilote rien : elle suit seulement l'écran.
const fmt = (s) => {
  const a = Math.abs(Math.round(s));
  const m = Math.floor(a / 60), r = a % 60;
  return `${s < 0 ? "+" : ""}${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
const PRESETS = [10, 15, 20, 30, 45, 60, 90];

export default function Speaker() {
  const [v, setV] = useState(null);          // ce qui est à l'écran
  const [blank, setBlank] = useState(false);
  const [online, setOnline] = useState(false);
  const [scale, setScale] = useState(1);     // taille du texte choisie par l'orateur
  const [minutes, setMinutes] = useState(30);
  const [elapsed, setElapsed] = useState(0); // secondes écoulées
  const [running, setRunning] = useState(false);
  const box = useRef(null);
  const txt = useRef(null);
  const last = useRef(0);

  // réglages gardés sur cet appareil
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("hc.speaker.v1"));
      if (s?.minutes) setMinutes(s.minutes);
      if (s?.scale) setScale(s.scale);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("hc.speaker.v1", JSON.stringify({ minutes, scale })); } catch {}
  }, [minutes, scale]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("k");
    const ch = openScreen(token, (m) => {
      if (m.type === "show" || m.type === "update") setV(m);
      else if (m.type === "clear") setV(null);
      else if (m.type === "blank") setBlank((b) => (m.on === undefined ? !b : m.on));
      else if (m.type === "speakerState") { setV(m.shown || null); setBlank(!!m.blank); }
    }, { onReady: () => { setOnline(true); ch.postMessage({ type: "speaker?" }); } });
    ch.postMessage({ type: "speaker?" });   // même navigateur (BroadcastChannel)
    return () => ch.close();
  }, []);

  // chronomètre
  useEffect(() => {
    if (!running) return;
    last.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      setElapsed((e) => e + (now - last.current) / 1000);
      last.current = now;
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  // le texte courant remplit la zone sans déborder
  useLayoutEffect(() => {
    if (!v || !txt.current || !box.current) return;
    let size = Math.round(70 * scale);
    txt.current.style.fontSize = size + "px";
    while (size > 16 && txt.current.scrollHeight > box.current.clientHeight) {
      size -= 3;
      txt.current.style.fontSize = size + "px";
    }
  }, [v, scale]);

  const remaining = minutes * 60 - elapsed;
  const tone = remaining < 0 ? "text-red-400 animate-pulse" : remaining <= 300 ? "text-red-400" : remaining <= 600 ? "text-amber-300" : "text-white";
  const chant = v?.kind === "chant";
  const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-sm transition duration-100 active:scale-95";

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col"
         onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      {/* barre du haut : état de l'écran + chronomètre */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-green-400" : "bg-neutral-600"}`} title={online ? "Connecté" : "Connexion…"} />
          <span className={blank ? "text-amber-300" : v ? "text-green-400" : "text-neutral-500"}>
            {blank ? "Écran noir (le public ne voit rien)" : v ? "À l'écran" : "Rien à l'écran"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button className={btn} onClick={() => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(1)))} aria-label="Texte plus petit">A−</button>
            <button className={btn} onClick={() => setScale((s) => Math.min(1.6, +(s + 0.1).toFixed(1)))} aria-label="Texte plus grand">A+</button>
          </div>
          <select value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="rounded-lg bg-neutral-800 px-2 py-1.5 text-sm outline-none" aria-label="Durée prévue">
            {(PRESETS.includes(minutes) ? PRESETS : [...PRESETS, minutes].sort((a, b) => a - b)).map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <span className={`font-mono text-3xl sm:text-4xl tabular-nums min-w-[5.5ch] text-center ${tone}`}>{fmt(remaining)}</span>
          <button className={`${btn} ${running ? "" : "bg-amber-400 text-black hover:bg-amber-300 font-medium"}`} onClick={() => setRunning((r) => !r)}>{running ? "⏸ Pause" : elapsed > 0 ? "▶ Reprendre" : "▶ Démarrer"}</button>
          <button className={btn} onClick={() => { setRunning(false); setElapsed(0); }} aria-label="Remettre à zéro">↺</button>
        </div>
      </div>

      {/* texte en cours */}
      <div className="flex-1 min-h-0 flex flex-col px-[4vw] py-[2vh]">
        {v && v.kind === "media" ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
            {v.mediaType === "image"
              ? <img src={v.url} alt="" className={`max-h-[70%] max-w-full object-contain rounded ${blank ? "opacity-50" : ""}`} />
              : <span className="text-7xl">🎬</span>}
            <div className="text-amber-300 text-[3vh]">{v.mediaType === "video" ? "Vidéo : " : ""}{v.ref}</div>
          </div>
        ) : v ? (
          <>
            <div ref={box} className={`flex-1 min-h-0 flex ${chant ? "justify-center" : ""} items-center`}>
              <p ref={txt} className={`${chant ? "w-full text-center font-sans font-bold leading-[1.25]" : "font-serif leading-snug"} ${v.kind === "slide" ? "w-full text-center" : ""} whitespace-pre-line ${blank ? "opacity-60" : ""}`}>{v.text}</p>
            </div>
            <div className="text-right text-[3vh] pt-[1vh] text-amber-300">{v.ref} <span className="opacity-60 text-[2.2vh]">{v.version}</span></div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-xl">En attente d'un verset…</div>
        )}
      </div>

      {/* à suivre */}
      {v?.next?.text && (
        <div className="border-t border-neutral-800 bg-neutral-900/70 px-[4vw] py-[1.5vh] max-h-[22vh] overflow-hidden">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">À suivre{v.next.ref ? ` · ${v.next.ref}` : ""}</div>
          <p className="text-neutral-300 text-[2.4vh] leading-snug whitespace-pre-line line-clamp-3">{v.next.text}</p>
        </div>
      )}
    </div>
  );
}
