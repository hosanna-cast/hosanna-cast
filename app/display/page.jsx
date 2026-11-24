"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openScreen } from "@/lib/screen";
import { uuid } from "@/lib/uuid";
import { bgStyle } from "../control/Backgrounds";
import { RichText } from "@/lib/bold";
import ColsText from "@/lib/ColsText";
import { DEFAULT_SETTINGS, mergeSettings, loadSettings, saveSettings, loadLogo, saveLogo } from "@/lib/displaySettings";
import { useWakeLock } from "@/lib/useWakeLock";

// messages dont l'écran confirme la réception à la console (sans confirmation, elle renvoie l'état complet)
const ACKED = new Set(["show", "update", "clear", "blank", "snapshot"]);

export default function Display() {
  const [v, setV] = useState(null);
  const [blank, setBlank] = useState(false);
  const [bg, setBg] = useState(null);                     // fond choisi dans l'Administration
  const [layout, setLayout] = useState("full");           // « full » plein écran, « band » bandeau en bas (temps de prière, direct)
  const [transparent, setTransparent] = useState(false);  // /display?k=…&transparent=1 : fond transparent, pour OBS / vMix
  const [textColor, setTextColor] = useState("#ffffff");   // couleur du texte
  const [forcedMute, setForcedMute] = useState(false);     // le navigateur a bloqué le son : un clic sur la page le réactive
  const [cfg, setCfg] = useState(DEFAULT_SETTINGS);     // réglages bandeau / plein écran envoyés par la console
  const [logo, setLogo] = useState(null);                 // logo (PNG transparent) envoyé par la console
  const box = useRef(null);
  const txt = useRef(null);
  const vid = useRef(null);
  const chRef = useRef(null);
  const resume = useRef({ url: null, t: 0 });              // reprise de la vidéo si l'écran noir est activé puis retiré
  useWakeLock(true);                                       // l'écran de projection ne se met jamais en veille
  const [idle, setIdle] = useState(false);                 // souris immobile : le curseur disparaît (il ne traîne pas sur la projection)
  const [isFs, setIsFs] = useState(false);
  const [hint, setHint] = useState(true);                  // rappel « clic = plein écran », quelques secondes après l'ouverture

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    let t;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    const onFs = () => setIsFs(!!document.fullscreenElement);
    const onKey = (e) => { if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFs(); };
    wake();
    const hintTimer = setTimeout(() => setHint(false), 9000);
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { clearTimeout(t); clearTimeout(hintTimer); window.removeEventListener("mousemove", wake); window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  useEffect(() => {
    // /display?k=<jeton> : le jeton est dans le lien « Écran » de la console (copiable pour un autre appareil)
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get("k");
    if (qs.get("transparent") === "1") {
      setTransparent(true);
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
    }
    setCfg(loadSettings());                          // dernière version reçue, gardée sur cet appareil (avant que la console réponde)
    setLogo(loadLogo());
    const ch = openScreen(token, (m) => {
      if (ACKED.has(m.type)) requestAnimationFrame(() => chRef.current?.postMessage({ type: "ack", ref: m.mid }));
      // état complet : à l'ouverture, après une coupure internet, ou quand la console n'a pas eu de confirmation.
      // L'écran ne dépend donc plus d'un message passé : recharger la page ne le laisse plus vide.
      if (m.type === "snapshot") {
        setBg(m.bg || null);
        setTextColor(m.textColor || "#ffffff");
        if (m.settings) { const c = mergeSettings(m.settings); setCfg(c); saveSettings(c); }
        setLayout(m.layout === "band" ? "band" : "full");
        setBlank(!!m.blank);
        setV(m.shown || null);
        return;
      }
      if (m.type === "settings") { const c = mergeSettings(m.settings); setCfg(c); saveSettings(c); return; }
      if (m.type === "logo") { setLogo(m.logo || null); saveLogo(m.logo || null); return; }
      if (m.type === "layout") { setLayout(m.mode === "band" ? "band" : "full"); return; }
      if (m.type === "bg") { setBg(m.bg || null); setTextColor(m.textColor || "#ffffff"); return; }
      if (m.type === "show") { resume.current = { url: null, t: 0 }; setV(m); }   // l'écran noir reste noir : seul « Noir » / Ctrl+E le désactive
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
    }, {
      role: "display",
      me: { id: uuid(), name: "Écran", role: "display" },          // présence : la console sait qu'un écran est connecté
      onReady: () => chRef.current?.postMessage({ type: "display?" }),   // (re)connexion internet : on redemande l'état complet
    });
    chRef.current = ch;
    ch.postMessage({ type: "display?" });            // l'écran vient de s'ouvrir : on demande l'état complet (verset, noir, fond, réglages)
    return () => ch.close();
  }, []);

  // ajuste la taille du texte pour qu'il tienne toujours à l'écran
  useLayoutEffect(() => {
    if (!v || blank || v.kind === "media" || !txt.current || !box.current) return;
    // plein écran : taille max réglable ; bandeau : taille de départ proportionnelle à sa hauteur
    let size = layout === "band" ? Math.min(120, Math.round(52 * cfg.band.height / 20)) : cfg.full.maxFont;
    txt.current.style.fontSize = size + "px";
    const cs = getComputedStyle(box.current);
    const room = box.current.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);   // place réelle pour le texte
    // mêmes tailles qu'avant (start, start-3, start-6… jusqu'à 18 px), mais trouvées par dichotomie :
    // ~6 mesures au lieu d'une trentaine, donc le texte apparaît plus vite à l'écran
    const start = size;
    const kMax = start <= 18 ? 0 : Math.ceil((start - 18) / 3);
    let lo = 0, hi = kMax;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      txt.current.style.fontSize = start - 3 * mid + "px";
      if (txt.current.scrollHeight <= room) hi = mid; else lo = mid + 1;
    }
    txt.current.style.fontSize = start - 3 * lo + "px";
  }, [v, blank, layout, cfg, logo]);

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

  // le bandeau est sombre si le texte est clair, clair si le texte est foncé (toujours lisible)
  const lum = (() => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(textColor || ""); return m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 1; })();
  const darkBand = lum > 0.55;
  const bandBg = "transparent";   // plus de fond noir derrière le texte
  const bandFg = textColor;
  const shadow = "0 0.2vh 0.8vh rgba(0,0,0,0.85), 0 0 0.3vh rgba(0,0,0,0.9)";   // lisibilité sans fond
  const band = layout === "band" && !blank && v && v.kind !== "media";
  const B = cfg.band, F = cfg.full;
  const bandLogo = false;   // le logo reste toujours à sa place (réglage « fond d'écran »), en plein écran comme en bandeau
  const fullLogo = false;
  const logoLeft = B.logoSide === "left";
  // le logo s'affiche en haut à droite, avec ou sans fond (ne dépend plus du fond reçu : un fond perdu en route ne le cache plus) (sauf s'il est déjà montré par le bandeau / plein écran, ou en écran noir / vidéo)
  const logoShownByLayout = band ? bandLogo : (fullLogo && v && v.kind !== "media");
  const bgLogo = logo && !blank && !logoShownByLayout && !(v && v.kind === "media");
  const vAlign = { top: "items-start", center: "items-center", bottom: "items-end" }[F.valign];
  // transition douce : le contenu est remonté (donc rejoué en fondu) quand le texte, la page ou la mise en page change ;
  // un changement de gras / souligné ne rejoue rien. L'écran noir, lui, est toujours instantané.
  const fadeOn = cfg.fade > 0;
  const fadeKey = `${v?.ref}|${v?.page?.i}|${v?.text}|${v?.url}|${layout}|${blank}`;
  const fxc = fadeOn ? " hc-fade" : "";
  const fxs = fadeOn ? { animationDuration: cfg.fade + "ms" } : undefined;
  const pg = v?.page ? <span className="ml-[0.6em] text-[0.6em] opacity-70">{v.page.i + 1}/{v.page.n}</span> : null;

  return (
    <div className={`fixed inset-0 ${transparent ? "" : "bg-black"} text-white flex flex-col ${band ? "justify-end" : "justify-center"}`}
         style={{ ...(band ? { padding: "4vh 6vw" } : { padding: `${F.padTop}vh ${F.padX}vw ${F.padBottom}vh` }), ...(transparent ? {} : bgStyle(blank ? null : bg)), color: textColor, ...(idle ? { cursor: "none" } : {}) }}
         onClick={() => { unmute(); if (!document.fullscreenElement && !forcedMute && !transparent) toggleFs(); }}>
      {!blank && v && v.kind === "media" && (
        <div key={`m|${v.url}`} className={"absolute inset-0 bg-black flex items-center justify-center" + fxc} style={fxs}>
          {v.mediaType === "video" ? (
            <video key={v.url} ref={vid} src={v.url} playsInline className="max-w-full max-h-full"
              onPlaying={() => report(vid.current?.muted && forcedMute ? "muted" : "playing")}
              onError={() => report("error")}
              onLoadedMetadata={(e) => { if (resume.current.url === v.url) e.currentTarget.currentTime = resume.current.t; }}
              onTimeUpdate={(e) => { resume.current = { url: v.url, t: e.currentTarget.currentTime }; }} />
          ) : (
            <img key={v.url} src={v.url} alt="" referrerPolicy="no-referrer" onError={() => report("error")} className="max-w-full max-h-full object-contain" />
          )}
          {v.overlay && v.overlay.text && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center" style={{ padding: "4vh 6vw" }}>
              <div className="max-w-full rounded-[2.2vh] px-[2.5vw] py-[2vh] text-center" style={{ background: "rgba(0,0,0,0.72)", color: "#ffffff", maxHeight: "50vh", overflow: "hidden" }}>
                <p className="font-serif leading-snug whitespace-pre-line" style={{ fontSize: v.overlay.text.length < 120 ? "4.6vh" : v.overlay.text.length < 260 ? "3.8vh" : "3vh" }}>{v.overlay.text}</p>
                <div className="mt-[1vh] font-semibold" style={{ fontSize: "3vh", color: "#fbbf24" }}>{v.overlay.ref} {v.overlay.version ? <span className="opacity-60 text-[2.2vh]">{v.overlay.version}</span> : null}</div>
              </div>
            </div>
          )}
          {forcedMute && v.mediaType === "video" && (
            <span className="absolute bottom-3 right-4 rounded-full bg-black/60 text-white/80 text-xs px-3 py-1">🔇 Clique pour activer le son</span>
          )}
        </div>
      )}

      {bgLogo && (
        <img src={logo} alt="" draggable={false} className="absolute w-auto h-auto object-contain pointer-events-none select-none"
             style={{ top: "2vh", [cfg.top.side === "left" ? "left" : "right"]: "2vw", maxWidth: `${250 * cfg.top.size / 100}px`, maxHeight: `${250 * cfg.top.size / 100}px` }} />
      )}

      {fullLogo && !band && !blank && v && v.kind !== "media" && (
        <img src={logo} alt="" draggable={false} className="absolute w-auto object-contain pointer-events-none select-none"
             style={{ top: "2vh", right: "2vw", height: `${F.logoSize}vh` }} />
      )}

      {band && (
        <div key={fadeKey} className={"mb-[1vh]" + fxc} style={fxs}>
          <div className={`flex mb-[1vh] ${v.cols ? "justify-center" : bandLogo && !logoLeft ? "justify-start" : "justify-end"}`}>
            <span className={`rounded-[0.8vh] px-[1.4vw] py-[0.5vh] text-[2.6vh] font-medium ${v.ref ? "" : "hidden"}`} style={{ color: v.cols ? "#fbbf24" : bandFg, textShadow: shadow }}>
              {v.ref} {v.version && !v.cols ? <span className="opacity-60 text-[2.1vh]">{v.version}</span> : null}{pg}
            </span>
          </div>
          <div className={`relative flex items-stretch gap-[2vw] rounded-[2.2vh] px-[2.5vw] ${logoLeft ? "" : "flex-row-reverse"}`}
               style={{ color: bandFg, textShadow: shadow, height: `${B.height}vh` }}>
            {bandLogo && (
              <img src={logo} alt="" draggable={false} className="shrink-0 w-auto object-contain self-start pointer-events-none select-none"
                   style={{ height: `${B.logoSize}vh`, marginTop: `${-B.logoRise}vh` }} />
            )}
            <div ref={box} className="flex-1 min-w-0 h-full overflow-hidden flex items-center py-[1.5vh]">
              {v.kind === "chant" ? (
                <p ref={txt} className="w-full text-center font-sans font-bold leading-[1.25] whitespace-pre-line">{v.text}</p>
              ) : (
                <p ref={txt} className={`w-full leading-snug font-serif whitespace-pre-line ${v.kind === "slide" ? "text-center" : ""}`}>{v.cols ? <ColsText cols={v.cols} /> : <RichText text={v.text} bold={v.bold} under={v.under} />}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!band && !blank && v && v.kind === "chant" && (
        <div key={fadeKey} className={"flex-1 flex flex-col min-h-0" + fxc} style={fxs}>
          <div ref={box} className={`flex-1 flex ${vAlign} justify-center min-h-0`}>
            <p ref={txt} className="w-full text-center font-sans font-bold leading-[1.25] whitespace-pre-line">{v.text}</p>
          </div>
          <div className="text-center text-[2.2vh] pt-[1.5vh]">{v.ref}</div>
        </div>
      )}
      {!band && !blank && v && v.kind !== "chant" && v.kind !== "media" && (
        <div key={fadeKey} className={"flex-1 flex flex-col min-h-0" + fxc} style={fxs}>
          <div ref={box} className={`flex-1 flex ${vAlign} min-h-0`}>
            <p ref={txt} className={`leading-snug font-serif whitespace-pre-line ${v.kind === "slide" ? "w-full text-center" : ""}`}>{v.cols ? <ColsText cols={v.cols} /> : <RichText text={v.text} bold={v.bold} under={v.under} />}</p>
          </div>
          {v.cols
            ? <div className="text-center text-[4vh] pt-[2vh] font-semibold" style={{ color: "#fbbf24" }}>{v.ref}</div>
            : <div className={`text-right text-[4vh] pt-[2vh] ${v.ref ? "" : "hidden"}`}>{v.ref} <span className="opacity-60 text-[2.5vh]">{v.version}</span>{pg}</div>}
        </div>
      )}
      {hint && !isFs && !transparent && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 text-white/70 text-xs px-3 py-1 pointer-events-none select-none">
          Clique ou appuie sur F pour le plein écran
        </div>
      )}
    </div>
  );
}
