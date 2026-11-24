"use client";

// Menu déroulant unique des versions de la Bible.
//  - bleu  : versions de l'application (LSG, OST, DBY, KJV…)
//  - jaune : versions « bible.com » (S21, BDS, BFC, NFC…) ; si elles ne sont pas disponibles dans l'application, le choix ouvre bible.com (↗)
// onWeb(v) est appelé pour une version qui ne peut qu'ouvrir bible.com ; sans onWeb, ces versions ne sont pas proposées.
const BLUE = "#60a5fa";
const AMBER = "#fbbf24";
const optStyle = (color) => ({ color, background: "#262626" });
// indication de langue : FR (français) ou GB (anglais). Les versions locales n'ont pas de champ « lang » : seule la KJV est en anglais.
const tag = (v) => ((v.lang || (v.id === "kjv" ? "en" : "fr")) === "en" ? "GB" : "FR");

export default function VersionSelect({ versions, value, onChange, webVersions = [], onWeb, loading = false, disabled = false, className = "" }) {
  const ids = new Set(versions.map((v) => v.id));
  const webOnly = onWeb ? webVersions.filter((w) => !ids.has(w.id)) : [];
  const current = versions.find((v) => v.id === value);
  const color = current?.online ? AMBER : BLUE;
  return (
    <select value={value} disabled={disabled} title={current?.full}
      onChange={(e) => {
        const val = e.target.value;
        if (val.startsWith("web:")) { onWeb?.(webOnly.find((w) => w.id === val.slice(4))); return; }
        onChange(val);
      }}
      style={{ color, colorScheme: "dark" }}
      className={`w-full min-w-0 rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 ${loading ? "animate-pulse" : ""} ${className}`}>
      {["FR", "GB"].map((g) => {
        const own = versions.filter((v) => tag(v) === g);
        const web = webOnly.filter((w) => tag(w) === g);
        if (!own.length && !web.length) return null;
        return (
          <optgroup key={g} label={g} style={{ color: "#a3a3a3", background: "#262626" }}>
            {own.map((v) => (
              <option key={v.id} value={v.id} style={optStyle(v.online ? AMBER : BLUE)}>{v.label} · {v.full}</option>
            ))}
            {web.map((w) => (
              <option key={w.id} value={"web:" + w.id} style={optStyle(AMBER)}>{w.label} · {w.full} ↗</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
