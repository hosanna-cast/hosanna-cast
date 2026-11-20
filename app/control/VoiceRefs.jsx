"use client";
import { useEffect, useRef, useState } from "react";
import { findSpokenRefs } from "@/lib/voiceRefs";

// Détection vocale des références (TEST) : le micro écoute, une suggestion apparaît, l'opérateur confirme d'un clic.
// Rien n'est jamais projeté tout seul. Pour supprimer la fonction : effacer ce fichier, lib/voiceRefs.js
// et les 2 lignes « Voice » de app/control/page.jsx.
//
// resolve(c)  : { b, chapter, verse, vEnd } → { b, c, v, vEnd, label } si le passage existe dans la Bible chargée, sinon null
// onPick(r)   : r.v === null → ouvrir le chapitre ; sinon projeter le verset
const TTL = 90000;        // une suggestion disparaît après 90 s
const MAX = 4;

const same = (a, b) => a.b === b.b && a.c === b.c;
const key = (r) => `${r.b}-${r.c}-${r.v}-${r.vEnd}`;

export default function VoiceRefs({ resolve, onPick, canProject }) {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [chips, setChips] = useState([]);
  const [err, setErr] = useState("");
  const recRef = useRef(null);
  const want = useRef(false);
  const resolveRef = useRef(resolve);
  const dismissed = useRef(new Map());     // suggestions déjà utilisées / écartées : pas de retour pendant 15 s
  resolveRef.current = resolve;

  useEffect(() => { setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition)); }, []);

  const add = (r) => {
    const t = Date.now();
    const k = key(r);
    if (t - (dismissed.current.get(k) || 0) < 15000) return;
    setChips((list) => {
      // une référence plus précise remplace la précédente (« Jean 3 » puis « Jean 3:16 »), jamais l'inverse
      if (list.some((o) => same(o, r) && (o.v === r.v ? (o.vEnd ?? null) === (r.vEnd ?? null) || r.vEnd == null : r.v == null))) return list;
      const rest = list.filter((o) => !(same(o, r) && (o.v == null || (o.v === r.v && o.vEnd == null))));
      return [{ ...r, k, t }, ...rest].slice(0, MAX);
    });
  };

  const stop = () => {
    want.current = false;
    setOn(false); setListening(false);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch {} }
  };

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setErr(""); setHeard("");
    want.current = true;
    setOn(true);
    const launch = () => {
      if (!want.current) return;
      const rec = new SR();
      rec.lang = "fr-FR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onstart = () => setListening(true);
      rec.onresult = (e) => {
        let last = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0]?.transcript || "";
          last = text;
          for (const c of findSpokenRefs(text)) {
            const r = resolveRef.current(c);
            if (r) add(r);
          }
        }
        if (last) setHeard(last.trim());
      };
      rec.onerror = (e) => {
        const code = e.error;
        if (code === "not-allowed" || code === "service-not-allowed") { setErr("Micro refusé : autorise le micro pour ce site dans le navigateur."); stop(); }
        else if (code === "audio-capture") { setErr("Aucun micro détecté."); stop(); }
        else if (code === "network") { setErr("Service vocal du navigateur injoignable (connexion Internet nécessaire)."); stop(); }
      };
      rec.onend = () => {                       // Chrome coupe l'écoute après un silence : on relance tant que c'est activé
        setListening(false);
        if (want.current) setTimeout(launch, 300);
      };
      recRef.current = rec;
      try { rec.start(); } catch { /* déjà démarré */ }
    };
    launch();
  };

  useEffect(() => () => { want.current = false; const rec = recRef.current; if (rec) { rec.onend = null; try { rec.abort(); } catch {} } }, []);

  // les suggestions périmées disparaissent
  useEffect(() => {
    if (!chips.length) return;
    const id = setInterval(() => setChips((l) => l.filter((c) => Date.now() - c.t < TTL)), 5000);
    return () => clearInterval(id);
  }, [chips.length]);

  const pick = (c) => {
    dismissed.current.set(c.k, Date.now());
    setChips((l) => l.filter((x) => x.k !== c.k));
    onPick(c);
  };
  const drop = (c) => { dismissed.current.set(c.k, Date.now()); setChips((l) => l.filter((x) => x.k !== c.k)); };

  return (
    <div className={`rounded-xl border p-2.5 sm:p-3 ${on ? "border-red-400/50 bg-red-500/5" : "border-neutral-700 bg-neutral-900"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={on ? stop : start} disabled={!supported} aria-pressed={on}
          title={supported ? "Active ou désactive l'écoute du micro" : "Non disponible sur ce navigateur (utilise Chrome ou Edge)"}
          className={`rounded-lg px-3 py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${on ? "bg-red-500 text-white font-medium" : "bg-neutral-800 hover:bg-neutral-700"}`}>
          🎤 Détection vocale {on ? "activée" : "désactivée"}
        </button>
        <span className="rounded-full bg-sky-400/15 text-sky-300 text-[10px] uppercase tracking-wide px-2 py-0.5">test</span>
        {on && <span className={`text-xs ${listening ? "text-red-300" : "text-neutral-500"}`} role="status">{listening ? "● Écoute…" : "Reconnexion…"}</span>}
        {!supported && <span className="text-xs text-neutral-500">Non disponible ici : utilise Chrome ou Edge.</span>}
      </div>

      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}

      {on && (
        <>
          <p className="mt-2 text-xs text-neutral-500 truncate" title={heard}>{heard ? `Entendu : « ${heard} »` : "Dis par exemple « Jean 3 16 » ou « Romains 8 28 à 30 »."}</p>
          {chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <li key={c.k} className="flex items-stretch rounded-lg overflow-hidden bg-amber-400 text-black">
                  <button onClick={() => pick(c)} disabled={c.v != null && !canProject}
                    title={c.v == null ? "Ouvrir ce chapitre" : "Projeter à l'écran"}
                    className="px-3 py-1.5 text-sm font-medium transition duration-100 active:scale-95 disabled:opacity-50">
                    {c.v == null ? "📖" : "▶"} {c.label}
                  </button>
                  <button onClick={() => drop(c)} aria-label="Ignorer" className="px-2 text-sm bg-black/15 hover:bg-black/30">✕</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-neutral-500 leading-4">Rien n'est projeté sans ton clic. Le navigateur envoie le son à son service de reconnaissance vocale en ligne.</p>
        </>
      )}
    </div>
  );
}
