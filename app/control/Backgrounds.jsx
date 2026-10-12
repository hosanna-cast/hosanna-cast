"use client";
import { useState } from "react";

export const MAX_BG = 3;
export const DEFAULT_TEXT = "#ffffff";
const TEXT_SWATCHES = [["#ffffff", "Blanc"], ["#facc15", "Jaune"], ["#fbbf24", "Ambre"], ["#000000", "Noir"]];

// bg = { type: "color" | "image", value: "#rrggbb" | "data:image/jpeg;base64,…" } ou null (noir)
export const bgStyle = (bg, dim = 0) => {
  if (!bg) return undefined;
  if (bg.type === "color") return { backgroundColor: bg.value };
  const shade = dim ? `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})), ` : "";
  return { backgroundImage: `${shade}url(${bg.value})`, backgroundSize: "cover", backgroundPosition: "center" };
};

// Image → JPEG 16:9 réduit : assez léger pour être envoyé à l'écran par internet (Supabase limite la taille des messages)
export async function fileToBg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let out = "";
    for (const [W, H] of [[1280, 720], [960, 540], [640, 360]]) {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const k = Math.max(W / img.width, H / img.height);          // « cover » : l'image remplit tout l'écran
      const w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      for (let q = 0.75; q >= 0.35; q -= 0.1) {
        out = c.toDataURL("image/jpeg", q);
        if (out.length < 170000) return { type: "image", value: out };
      }
    }
    return { type: "image", value: out };
  } finally { URL.revokeObjectURL(url); }
}

// Panneau de l'administration : 3 emplacements maximum, un seul fond actif pour tout l'écran.
export default function Backgrounds({ slots, active, onPick, onSet, onRemove, textColor = DEFAULT_TEXT, onText }) {
  const [busy, setBusy] = useState(-1);
  const [err, setErr] = useState("");

  const upload = async (i, file) => {
    if (!file) return;
    setErr(""); setBusy(i);
    try { onSet(i, await fileToBg(file)); } catch { setErr("Image illisible."); }
    setBusy(-1);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {slots.map((bg, i) => bg ? (
          <div key={i} role="button" tabIndex={0} onClick={() => onPick(active === i ? -1 : i)}
            onKeyDown={(e) => { if (e.key === "Enter") onPick(active === i ? -1 : i); }}
            style={bgStyle(bg)}
            className={`relative aspect-video rounded-lg cursor-pointer border-2 transition duration-100 active:scale-95 ${active === i ? "border-amber-400" : "border-neutral-600 hover:border-neutral-400"}`}>
            {onText && (
              <span className="absolute inset-0 flex items-center justify-center text-center font-bold text-sm sm:text-base px-2 pointer-events-none select-none" style={{ color: textColor }}>
                Aperçu du texte
              </span>
            )}
            {active === i && <span className="absolute bottom-1.5 left-1.5 rounded bg-amber-400 text-white text-xs font-medium px-2 py-0.5">Actif</span>}
            <button title="Supprimer ce fond" onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded bg-black/60 hover:bg-red-600 text-white text-xs">✕</button>
            {bg.type === "color" && (
              <label title="Changer la couleur du fond" onClick={(e) => e.stopPropagation()}
                className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs px-2 py-1 cursor-pointer overflow-hidden transition duration-100 active:scale-95">
                <span aria-hidden>🎨</span><span>Couleur</span>
                <input type="color" value={bg.value} onChange={(e) => onSet(i, { type: "color", value: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
            )}
          </div>
        ) : (
          <div key={i} className="aspect-video rounded-lg border border-dashed border-neutral-600 flex flex-col items-stretch justify-center gap-1.5 p-2">
            <label className="text-center text-sm rounded bg-neutral-700 hover:bg-neutral-600 py-1.5 cursor-pointer">
              {busy === i ? "…" : "+ Image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(i, e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button onClick={() => onSet(i, { type: "color", value: "#1e3a8a" })}
              className="text-sm rounded bg-neutral-700 hover:bg-neutral-600 py-1.5">+ Couleur</button>
          </div>
        ))}
      </div>
      <button onClick={() => onPick(-1)}
        className={`w-full mt-3 rounded-lg py-2 text-sm transition duration-100 active:scale-95 ${active < 0 ? "bg-neutral-600 text-white" : "bg-neutral-900 hover:bg-neutral-700 text-neutral-300"}`}>
        Aucun fond (noir)
      </button>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}

      {onText && (
        <div className="mt-4 pt-3 border-t border-neutral-700">
          <div className="text-sm font-medium mb-2">Couleur du texte</div>
          <div className="flex flex-wrap items-center gap-2">
            {TEXT_SWATCHES.map(([c, name]) => (
              <button key={c} title={name} onClick={() => onText(c)} style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border-2 transition duration-100 active:scale-90 ${textColor.toLowerCase() === c ? "border-amber-400 ring-2 ring-amber-400/40" : "border-neutral-500"}`} />
            ))}
            <label title="Autre couleur" className="relative w-8 h-8 rounded-full border-2 border-dashed border-neutral-500 overflow-hidden cursor-pointer flex items-center justify-center text-neutral-400 text-sm">
              +
              <input type="color" value={textColor} onChange={(e) => onText(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            {textColor.toLowerCase() !== DEFAULT_TEXT && (
              <button onClick={() => onText(DEFAULT_TEXT)} className="text-xs text-neutral-400 hover:text-white ml-1">Remettre en blanc</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
