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

export function RichText({ text, bold }) {
  if (!bold?.length) return text;
  const r = mergeRanges(bold).map(([a, b]) => [Math.max(0, a), Math.min(text.length, b)]).filter(([a, b]) => b > a);
  const out = [];
  let i = 0;
  r.forEach(([a, b], k) => {
    if (a > i) out.push(text.slice(i, a));
    out.push(<strong key={k} className="font-bold">{text.slice(a, b)}</strong>);
    i = b;
  });
  if (i < text.length) out.push(text.slice(i));
  return <>{out}</>;
}
