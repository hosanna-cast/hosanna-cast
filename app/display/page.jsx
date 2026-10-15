"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openScreen } from "@/lib/screen";
import { bgStyle } from "../control/Backgrounds";

export default function Display() {
  const [v, setV] = useState(null);
  const [blank, setBlank] = useState(false);
  const [bg, setBg] = useState(null);                     // fond choisi dans l'Administration
  const [textColor, setTextColor] = useState("#ffffff");   // couleur du texte
  const [forcedMute, setForcedMute] = useState(false);     // le navigateur a bloqué le son : un clic sur la page le réactive
  const box = useRef(null);
  const txt = useRef(null);
  const vid = useRef(null);
  const chRef = useRef(null);
  const resume = useRef({ url: null, t: 0 });              // reprise de la vidéo si l'écran noir est activé puis retiré

  useEffect(() => {
    // /display?k=<jeton> : le jeton est dans le lien « Écran » de la console (copiable pour un autre appareil)
    const token = new URLSearchParams(window.location.search).get("k");
    const ch = openScreen(token, (m) => {
      if (m.type === "bg") { setBg(m.bg || null); setTextColor(m.textColor || "#ffffff"); return; }
      if (m.type === "show") { resume.current = { url: null, t: 0 }; setV(m); }   // l'écran noir reste noir : seul « Noir » / Ctrl+B le désactive
      if (m.type === "update") setV(m);            // changement de version : l'écran noir reste noir
      if (m.type === "clear") setV(null);
      if (m.type === "blank") setBlank((b) => (m.on === undefined ? !b : m.on));   // « on » explicite : deux opérateurs ne se contredisent plus
      if (m.type === "media") {                    // commandes de la vidéo envoyées par la console
        const el = vid.current;
        if (!el) return;
        if (m.cmd === "toggle") { if (el.paused) el.play().catch(() => {}); else el.pause(); }
        else if (m.cmd === "restart") { el.currentTime = 0; el.play().catch(() => {}); }
        else if (m.cmd === "mute") el.muted = true;
        else if (m.cmd === "unmute") { el.muted = false; setForcedMute(false); }
      }
    });
    chRef.current = ch;
    ch.postMessage({ type: "bg?" });                // l'écran vient de s'ouvrir : on demande le fond et la couleur du texte
    return () => ch.close();
  }, []);

  // ajuste la taille du texte pour qu'il tienne toujours à l'écran
  useLayoutEffect(() => {
    if (!v || blank || v.kind === "media" || !txt.current || !box.current) return;
    let size = 90;
    txt.current.style.fontSize = size + "px";
    while (size > 18 && txt.current.scrollHeight > box.current.clientHeight) {
      size -= 3;
      txt.current.style.fontSize = size + "px";
    }
  }, [v, blank]);

  // vidéo : démarre toute seule ; si le navigateur refuse le son, elle démarre sans son (un clic le réactive)
  // la console sait ainsi si la vidéo joue vraiment (et pourquoi pas)
  const report = (status) => chRef.current?.postMessage({ type: "mediaStatus", status });
  const media = !blank && v?.kind === "media" && v.mediaType === "video";
  useEffect(() => {
    const el = vid.current;
    if (!media || !el) return;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setForcedMute(true);
      report("muted");
      el.play().catch(() => {});
    });
  }, [media, v?.url]);

  const unmute = () => {
    const el = vid.current;
    if (!forcedMute || !el) return;
    el.muted = false;
    setForcedMute(false);
    if (el.paused) el.play().catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-center px-[6vw] py-[4vh]"
         style={{ ...bgStyle(blank ? null : bg), color: textColor }}
         onClick={unmute}
         onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      {!blank && v && v.kind === "media" && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {v.mediaType === "video" ? (
            <video key={v.url} ref={vid} src={v.url} playsInline className="max-w-full max-h-full"
              onPlaying={() => report(vid.current?.muted && forcedMute ? "muted" : "playing")}
              onError={() => report("error")}
              onLoadedMetadata={(e) => { if (resume.current.url === v.url) e.currentTarget.currentTime = resume.current.t; }}
              onTimeUpdate={(e) => { resume.current = { url: v.url, t: e.currentTarget.currentTime }; }} />
          ) : (
            <img key={v.url} src={v.url} alt="" className="max-w-full max-h-full object-contain" />
          )}
          {forcedMute && v.mediaType === "video" && (
            <span className="absolute bottom-3 right-4 rounded-full bg-black/60 text-white/80 text-xs px-3 py-1">🔇 Clique pour activer le son</span>
          )}
        </div>
      )}
      {!blank && v && v.kind === "chant" && (
        <>
          <div ref={box} className="flex-1 flex items-center justify-center min-h-0">
            <p ref={txt} className="w-full text-center font-sans font-bold leading-[1.25] whitespace-pre-line">{v.text}</p>
          </div>
          <div className="text-center text-[2.2vh] pt-[1.5vh]">{v.ref}</div>
        </>
      )}
      {!blank && v && v.kind !== "chant" && v.kind !== "media" && (
        <>
          <div ref={box} className="flex-1 flex items-center min-h-0">
            <p ref={txt} className={`leading-snug font-serif whitespace-pre-line ${v.kind === "slide" ? "w-full text-center" : ""}`}>{v.text}</p>
          </div>
          <div className="text-right text-[4vh] pt-[2vh]">{v.ref} <span className="opacity-60 text-[2.5vh]">{v.version}</span></div>
        </>
      )}
    </div>
  );
}
