"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openScreen } from "@/lib/screen";

export default function Display() {
  const [v, setV] = useState(null);
  const [blank, setBlank] = useState(false);
  const box = useRef(null);
  const txt = useRef(null);

  useEffect(() => {
    // /display?k=<jeton> : le jeton est dans le lien « Écran » de la console (copiable pour un autre appareil)
    const token = new URLSearchParams(window.location.search).get("k");
    const ch = openScreen(token, (m) => {
      if (m.type === "show") { setBlank(false); setV(m); }
      if (m.type === "update") setV(m);            // changement de version : l'écran noir reste noir
      if (m.type === "clear") setV(null);
      if (m.type === "blank") setBlank((b) => (m.on === undefined ? !b : m.on));   // « on » explicite : deux opérateurs ne se contredisent plus
    });
    return () => ch.close();
  }, []);

  // ajuste la taille du texte pour qu'il tienne toujours à l'écran
  useLayoutEffect(() => {
    if (!v || blank || !txt.current || !box.current) return;
    let size = 90;
    txt.current.style.fontSize = size + "px";
    while (size > 18 && txt.current.scrollHeight > box.current.clientHeight) {
      size -= 3;
      txt.current.style.fontSize = size + "px";
    }
  }, [v, blank]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-center px-[6vw] py-[4vh]"
         onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      {!blank && v && v.kind === "chant" && (
        <>
          <div ref={box} className="flex-1 flex items-center justify-center min-h-0">
            <p ref={txt} className="w-full text-center font-sans font-bold leading-[1.25] whitespace-pre-line">{v.text}</p>
          </div>
          <div className="text-center text-white/30 text-[2.2vh] pt-[1.5vh]">{v.ref}</div>
        </>
      )}
      {!blank && v && v.kind !== "chant" && (
        <>
          <div ref={box} className="flex-1 flex items-center min-h-0">
            <p ref={txt} className={`leading-snug font-serif whitespace-pre-line ${v.kind === "slide" ? "w-full text-center" : ""}`}>{v.text}</p>
          </div>
          <div className="text-right text-amber-400 text-[4vh] pt-[2vh]">{v.ref} <span className="opacity-60 text-[2.5vh]">{v.version}</span></div>
        </>
      )}
    </div>
  );
}
