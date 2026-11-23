"use client";
import { useState } from "react";
import { LIMITS, mergeSettings, DEFAULT_SETTINGS } from "@/lib/displaySettings";

const Slider = ({ label, value, unit, range, onChange, disabled }) => (
  <label className="block">
    <span className="flex justify-between text-xs text-neutral-300 mb-0.5">
      <span>{label}</span><span className="tabular-nums text-neutral-400">{value}{unit}</span>
    </span>
    <input type="range" min={range[0]} max={range[1]} step="1" value={value} disabled={disabled}
      onChange={(e) => onChange(+e.target.value)} className="w-full accent-amber-400 disabled:opacity-40" />
  </label>
);

const Seg = ({ options, value, onChange, disabled, label }) => (
  <div className="grid gap-1 rounded-md bg-neutral-900 p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="group" aria-label={label}>
    {options.map(([k, l]) => (
      <button key={k} type="button" disabled={disabled} aria-pressed={value === k} onClick={() => onChange(k)}
        className={`rounded py-1 text-xs transition active:scale-95 disabled:opacity-40 ${value === k ? "bg-amber-400 text-black font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{l}</button>
    ))}
  </div>
);

// Dans l'Administration : le panneau est toujours ouvert. Ailleurs : ligne repliable.
function Wrap({ standalone, children }) {
  if (standalone) return <div>{children}</div>;
  return (
    <details className="mt-2 lg:mt-3 rounded-lg bg-neutral-800 group">
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm flex items-center justify-between text-neutral-200">
        <span>Réglages de l'écran</span>
        <span className="text-neutral-500 text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      {children}
    </details>
  );
}

// Panneau « Réglages de l'écran » : valeurs séparées pour le bandeau et le plein écran, réglages du logo, réinitialisation.
export default function DisplaySettings({ settings, logo, onSettings, disabled, standalone = false }) {
  const [mode, setMode] = useState("band");
  const s = settings[mode];
  const L = LIMITS[mode];

  const set = (patch) => onSettings(mergeSettings({ ...settings, [mode]: { ...settings[mode], ...patch } }));

  return (
    <Wrap standalone={standalone}>
      <div className={standalone ? "space-y-3 max-w-md" : "px-3 pb-3 space-y-3"}>
        <Seg label="Réglages pour" value={mode} onChange={setMode} options={[["band", "Bandeau"], ["full", "Plein écran"]]} />

        {mode === "band" ? (
          <>
            <Slider label="Hauteur du bandeau" unit=" %" value={s.height} range={L.height} disabled={disabled} onChange={(v) => set({ height: v })} />
            <Slider label="Longueur d'une page (passage long)" unit=" car." value={s.pageChars} range={L.pageChars} disabled={disabled} onChange={(v) => set({ pageChars: v })} />
          </>
        ) : (
          <>
            <Slider label="Marge gauche / droite" unit=" %" value={s.padX} range={L.padX} disabled={disabled} onChange={(v) => set({ padX: v })} />
            <Slider label="Marge du haut" unit=" %" value={s.padTop} range={L.padTop} disabled={disabled} onChange={(v) => set({ padTop: v })} />
            <Slider label="Marge du bas" unit=" %" value={s.padBottom} range={L.padBottom} disabled={disabled} onChange={(v) => set({ padBottom: v })} />
            <Slider label="Taille maximale du texte" unit=" px" value={s.maxFont} range={L.maxFont} disabled={disabled} onChange={(v) => set({ maxFont: v })} />
            <Slider label="Longueur d'une page (passage long)" unit=" car." value={s.pageChars} range={L.pageChars} disabled={disabled} onChange={(v) => set({ pageChars: v })} />
            <div>
              <span className="block text-xs text-neutral-300 mb-0.5">Alignement vertical</span>
              <Seg label="Alignement vertical" value={s.valign} disabled={disabled} onChange={(v) => set({ valign: v })} options={[["top", "Haut"], ["center", "Centre"], ["bottom", "Bas"]]} />
            </div>
          </>
        )}

        <div className="border-t border-neutral-700 pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={s.logoOn} disabled={disabled || !logo} onChange={(e) => set({ logoOn: e.target.checked })} className="accent-amber-400" />
              {mode === "band" ? "Logo dans le bandeau" : "Logo en haut à droite"}
            </label>
            {logo && <img src={logo} alt="" className="h-7 w-7 object-contain rounded bg-neutral-900" />}
          </div>
          {!logo && <p className="text-xs text-neutral-500">Aucun logo : ajoute-le dans « Fond de l'écran ».</p>}

          {logo && s.logoOn && (
            <>
              <Slider label="Taille du logo" unit=" %" value={s.logoSize} range={L.logoSize} disabled={disabled} onChange={(v) => set({ logoSize: v })} />
              {mode === "band" && (
                <>
                  <div>
                    <span className="block text-xs text-neutral-300 mb-0.5">Position du logo</span>
                    <Seg label="Position du logo" value={s.logoSide} disabled={disabled} onChange={(v) => set({ logoSide: v })} options={[["left", "Gauche"], ["right", "Droite"]]} />
                  </div>
                  <Slider label="Dépasse au-dessus du bandeau" unit=" %" value={s.logoRise} range={L.logoRise} disabled={disabled} onChange={(v) => set({ logoRise: v })} />
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-neutral-700 pt-3">
          <Slider label="Transition douce du texte" unit={settings.fade ? " ms" : " (aucune)"} value={settings.fade} range={LIMITS.fade} disabled={disabled}
            onChange={(v) => onSettings(mergeSettings({ ...settings, fade: v }))} />
          <p className="text-[11px] text-neutral-500 mt-1">Un passage plus long que la limite est découpé en pages ; ← → passent d'une page à l'autre.</p>
        </div>

        <button type="button" disabled={disabled} onClick={() => onSettings(mergeSettings({ ...DEFAULT_SETTINGS, top: settings.top }))}
          className="w-full rounded-md bg-neutral-700 hover:bg-neutral-600 py-1.5 text-xs disabled:opacity-40">Réinitialiser les réglages</button>
      </div>
    </Wrap>
  );
}
