// Outils de normalisation et de correction orthographique (aucune dépendance)

// minuscules, sans accents, œ → oe
export const fold = (s) =>
  s.replace(/œ/gi, "oe").replace(/æ/gi, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// forme « phonétique » légère d'un mot déjà sans accents :
// filipiens = philippiens, mathieu = matthieu, apocalipse = apocalypse, pluriel retiré
export const phonWord = (w) => {
  let t = w.replace(/ph/g, "f").replace(/th/g, "t").replace(/y/g, "i").replace(/([a-z])\1+/g, "$1");
  if (t.length > 3 && t.endsWith("s")) t = t.slice(0, -1);
  return t;
};

// texte → liste de mots normalisés
export const tokenize = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean).map(phonWord);

// distance d'édition avec inversion de deux lettres comptée comme 1 faute (« jena » → « jean »)
export function dist(a, b) {
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const d = Array.from({ length: al + 1 }, (_, i) => { const r = new Array(bl + 1); r[0] = i; return r; });
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

// nombre de fautes tolérées selon la longueur du mot
export const maxEdits = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

// vocab : Map mot → fréquence. Retourne une fonction qui remplace un mot mal écrit par le mot le plus proche.
export function makeCorrector(vocab) {
  const words = [...vocab.keys()];
  const memo = new Map();
  return (t) => {
    if (t.length <= 3 || /\d/.test(t)) return t;
    if (memo.has(t)) return memo.get(t);
    let out = t;
    if (!words.some((w) => w.startsWith(t))) {           // début de mot valide : on n'y touche pas
      const max = maxEdits(t.length);
      let best = null, bestD = Infinity, bestF = -1;
      for (const w of words) {
        let d = Infinity;
        if (Math.abs(w.length - t.length) <= max) d = dist(t, w);
        if (w.length > t.length) d = Math.min(d, dist(t, w.slice(0, t.length)) + 0.5); // mot encore en cours de frappe
        if (d > max) continue;
        const f = vocab.get(w);
        if (d < bestD || (d === bestD && f > bestF)) { best = w; bestD = d; bestF = f; }
      }
      if (best) out = best;
    }
    memo.set(t, out);
    return out;
  };
}
