// Pagination des longs passages : un passage (Ps 119, Luc 15 entier…) est découpé en pages lisibles
// au lieu d'être rétréci jusqu'à 18 px.
//
// Principes :
//  - on coupe d'abord entre les versets ; un verset trop long est coupé entre ses phrases, puis ses virgules, puis ses mots ;
//  - les pages sont équilibrées (pas une longue page suivie d'une page de trois mots) ;
//  - le numéro d'un verset reste toujours collé au début de son texte.

// Longueur maximale d'une page (en caractères), par mise en page. Réglable dans l'Administration (pageChars).
export const DEFAULT_PAGE_CHARS = { full: 420, band: 200 };

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// coupe un texte trop long en morceaux ≤ max : phrases, puis virgules, puis mots
function splitLong(text, max) {
  const out = [];
  const pack = (pieces) => {
    let cur = "";
    for (const p of pieces) {
      if (cur && (cur + " " + p).length > max) { out.push(cur); cur = p; }
      else cur = cur ? cur + " " + p : p;
    }
    if (cur) out.push(cur);
  };
  const bySentence = text.match(/[^.!?…;:]+[.!?…;:]+["»”)]*|[^.!?…;:]+$/g)?.map(clean).filter(Boolean) || [text];
  const pieces = [];
  for (const s of bySentence) {
    if (s.length <= max) { pieces.push(s); continue; }
    const byComma = s.match(/[^,]+,?/g)?.map(clean).filter(Boolean) || [s];
    for (const c of byComma) {
      if (c.length <= max) { pieces.push(c); continue; }
      const words = c.split(" ");                 // dernier recours : par mots
      let cur = "";
      for (const w of words) {
        if (cur && (cur + " " + w).length > max) { pieces.push(cur); cur = w; }
        else cur = cur ? cur + " " + w : w;
      }
      if (cur) pieces.push(cur);
    }
  }
  pack(pieces);
  return out;
}

// units : liste de textes (un par verset, numéro déjà devant si besoin). Renvoie la liste des pages (au moins une).
export function paginate(units, max) {
  const list = units.map(clean).filter(Boolean);
  const limit = Math.max(40, Math.floor(max) || DEFAULT_PAGE_CHARS.full);
  const total = list.reduce((n, u) => n + u.length, 0) + Math.max(0, list.length - 1);
  if (total <= limit) return [list.join(" ")];

  // un verset plus long que la limite devient plusieurs morceaux
  const pieces = list.flatMap((u) => (u.length <= limit ? [u] : splitLong(u, limit)));

  // pages équilibrées : on vise total / nombre de pages, sans jamais dépasser la limite
  const n = Math.ceil(total / limit);
  const target = total / n;
  const pages = [];
  let cur = "";
  for (const p of pieces) {
    const joined = cur ? cur + " " + p : p;
    if (cur && joined.length > limit) { pages.push(cur); cur = p; continue; }
    cur = joined;
    if (cur.length >= target && pages.length < n - 1) { pages.push(cur); cur = ""; }
  }
  if (cur) pages.push(cur);
  return pages;
}

// Pages d'un passage : vs = versets du chapitre, v → vEnd (indices, vEnd peut être null).
// Plusieurs versets : chaque verset est précédé de son numéro (comme avant).
export function pagesOfRange(vs, v, vEnd, max) {
  const end = Math.min(vEnd ?? v, vs.length - 1);
  const units = [];
  for (let i = v; i <= end; i++) units.push((end > v ? `${i + 1} ` : "") + (vs[i] ?? ""));
  return paginate(units, max);
}
