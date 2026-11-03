// Gras sur une partie du texte projeté.
// Le gras est une liste de plages [début, fin] en nombre de caractères du texte : le texte lui-même n'est jamais modifié.

export function mergeRanges(ranges) {
  const r = (ranges || []).filter(([a, b]) => b > a).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of r) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// Ctrl+B : si toute la sélection est déjà en gras on l'enlève, sinon on la met en gras
export function toggleRange(ranges, s, e) {
  const r = mergeRanges(ranges);
  if (r.some(([a, b]) => a <= s && b >= e)) {
    const out = [];
    for (const [a, b] of r) {
      if (b <= s || a >= e) out.push([a, b]);
      else { if (a < s) out.push([a, s]); if (b > e) out.push([e, b]); }
    }
    return out;
  }
  return mergeRanges([...r, [s, e]]);
}

// gras et/ou souligné : les deux listes de plages peuvent se chevaucher
export function RichText({ text, bold, under }) {
  const b = mergeRanges(bold);
  const u = mergeRanges(under);
  if (!b.length && !u.length) return text;
  const inR = (r, p) => r.some(([x, y]) => p >= x && p < y);
  const pts = [...new Set([0, text.length, ...b.flat(), ...u.flat()])].filter((p) => p >= 0 && p <= text.length).sort((x, y) => x - y);
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const part = text.slice(pts[k], pts[k + 1]);
    const isB = inR(b, pts[k]);
    const isU = inR(u, pts[k]);
    out.push(isB || isU
      ? <span key={k} className={`${isB ? "font-bold" : ""} ${isU ? "underline underline-offset-[0.12em] decoration-[0.06em]" : ""}`}>{part}</span>
      : part);
  }
  return <>{out}</>;
}
