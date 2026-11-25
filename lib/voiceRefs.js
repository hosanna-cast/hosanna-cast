// Détection vocale (TEST) : repère une référence biblique dans une phrase prononcée.
// « Jean chapitre trois verset seize », « psaume cent dix-neuf », « première épître aux Corinthiens 13 », « Romains 8 28 à 30 »
// → [{ b, chapter, verse, vEnd }]   (chapter / verse 1-based ; verse = null si seul le chapitre est cité)
// Pour supprimer la fonction : effacer ce fichier, app/control/VoiceRefs.jsx et les 2 lignes « Voice » de app/control/page.jsx.
import { BOOKS, EN_BOOKS } from "./books";
import { fold, tokenize } from "./textUtil";

// Français + anglais : la langue de reconnaissance vocale est choisie dans VoiceRefs.jsx, les deux vocabulaires sont compris ici.
const UNITS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9 };
const TEENS = { dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORD = { premier: "1", premiere: "1", "1er": "1", "1ere": "1", "1re": "1", deuxieme: "2", second: "2", seconde: "2", "2eme": "2", "2e": "2", troisieme: "3", "3eme": "3", "3e": "3", first: "1", "1st": "1", "2nd": "2", third: "3", "3rd": "3" };
const SKIP = new Set(["chapitre", "chapitres", "verset", "versets", "epitre", "lettre", "livre", "evangile", "selon", "aux", "de", "du", "d", "l", "chapter", "chapters", "verse", "verses", "epistle", "letter", "book", "gospel", "according", "of", "the"]);
const DIGITS = /^\d+$/;

// 1 à 99 à partir de mots : « vingt trois », « soixante dix sept », « quatre vingt dix »
function below100(t, i) {
  const w = t[i];
  if (w == null) return null;
  let base = null, j = i + 1;
  if (w === "quatre" && t[i + 1] === "vingt") { base = 80; j = i + 2; }
  else if (w in TENS) base = TENS[w];
  if (base != null) {
    const n = t[j];
    if ((base === 60 || base === 80) && n in TEENS) {
      let v = base + TEENS[n]; j++;
      if (n === "dix" && ["sept", "huit", "neuf"].includes(t[j])) { v += UNITS[t[j]]; j++; }
      return [v, j];
    }
    if (n === "et" && (t[j + 1] === "un" || t[j + 1] === "une")) return [base + 1, j + 2];
    if (n === "et" && t[j + 1] === "onze" && (base === 60 || base === 80)) return [base + 11, j + 2];
    if (n in UNITS && UNITS[n] > 0) return [base + UNITS[n], j + 1];
    return [base, j];
  }
  if (w in TEENS) {
    let v = TEENS[w], k = i + 1;
    if (w === "dix" && ["sept", "huit", "neuf"].includes(t[k])) { v += UNITS[t[k]]; k++; }
    return [v, k];
  }
  if (w in UNITS) return [UNITS[w], i + 1];
  return null;
}

function numberAt(t, i) {
  const w = t[i];
  if (w == null) return null;
  if (DIGITS.test(w)) return [parseInt(w, 10), i + 1];
  let base = 0, j = i;
  const HUND = (x) => x === "cent" || x === "hundred";
  if (HUND(w)) { base = 100; j = i + 1; }
  else if (w in UNITS && (UNITS[w] > 1 || w === "one") && HUND(t[i + 1])) { base = UNITS[w] * 100; j = i + 2; }
  if (base) {
    if (t[j] === "and" && t[j + 1] != null) j++;                       // « one hundred and nineteen »
    const r = below100(t, j);
    return r && r[0] > 0 ? [base + r[0], r[1]] : [base, j];
  }
  return below100(t, i);
}

// mots → chiffres : « trois seize » → « 3 16 », « chapitre » / « verset » retirés, « à » entre deux nombres → « - »
function toTokens(text) {
  // « à » (de 16 à 18) se distingue de « a » (il a) avant la suppression des accents
  let s = fold(String(text).replace(/(^|\s)[àÀ](?=\s|$)/g, " ZZTO ").replace(/(^|\s)(to|through|thru)(?=\s|$)/gi, " ZZTO ")).replace(/['’`]/g, " ").replace(/(\d)\s*[-–]\s*(\d)/g, "$1 zzto $2").replace(/(\d)\s*[:.,]\s*(\d)/g, "$1 $2").replace(/[-–]/g, " ");
  const raw = s.split(/[^a-z0-9]+/).filter(Boolean).map((w) => (w === "vingts" ? "vingt" : w === "cents" ? "cent" : w));
  const out = [];
  for (let i = 0; i < raw.length;) {
    const w = raw[i];
    const n = numberAt(raw, i);
    if (n) { out.push(String(n[0])); i = n[1]; continue; }
    if (w in ORD) out.push(ORD[w]);
    else if (w === "zzto") out.push("-");
    else if (!SKIP.has(w)) out.push(w);
    i++;
  }
  // « - » seulement entre deux nombres ; ailleurs on met un séparateur neutre (pour ne pas coller « Jean » et « 3 »)
  return out.map((w, i) => (w === "-" && !(DIGITS.test(out[i - 1] || "") && DIGITS.test(out[i + 1] || "")) ? "_" : w));
}

// noms de livres exacts (français + anglais), sans accents, avec ou sans « s » final
const NAMES = new Map();
const addName = (n, i) => { const k = fold(n).replace(/[^a-z0-9]/g, ""); NAMES.set(k, i); if (k.endsWith("s")) NAMES.set(k.slice(0, -1), i); else NAMES.set(k + "s", i); };
BOOKS.forEach(addName);
EN_BOOKS.forEach(addName);
[["isaie", 22], ["ezechiel", 25], ["psaume", 18], ["psalm", 18], ["actes des apotres", 43], ["apocalypse de jean", 65], ["cantique", 21], ["revelation", 65]].forEach(([n, i]) => addName(n, i));
const bookIdx = (num, w) => NAMES.get(num + w.replace(/[^a-z0-9]/g, ""));

export function findSpokenRefs(text) {
  const t = toTokens(text || "");
  const found = [];
  for (let i = 0; i < t.length;) {
    let j = i, num = "";
    if (/^[1-3]$/.test(t[j]) && t[j + 1] && !DIGITS.test(t[j + 1])) { num = t[j]; j++; }
    const w = t[j];
    if (!w || DIGITS.test(w) || w === "-") { i++; continue; }
    j++;
    const b = bookIdx(num, w);
    if (b === undefined || !DIGITS.test(t[j] || "")) { i++; continue; }
    const chapter = +t[j]; j++;
    let verse = null, vEnd = null;
    if (DIGITS.test(t[j] || "")) {
      verse = +t[j]; j++;
      if (t[j] === "-" && DIGITS.test(t[j + 1] || "")) { vEnd = +t[j + 1]; j += 2; }
    }
    if (chapter >= 1 && chapter <= 150 && (verse === null || (verse >= 1 && verse <= 176))) found.push({ b, chapter, verse, vEnd: vEnd && verse && vEnd > verse ? vEnd : null });
    i = j;
  }
  return found;
}


// ---------------------------------------------------------------------------------------------
// Détection par SIMILARITÉ : le prédicateur cite le texte d'un verset sans en donner la référence.
// text  : ce qui vient d'être entendu (les derniers mots comptent)
// index : index de recherche de la Bible chargée (lib/searchIndex.js) ; null pour les versions en ligne
// bible : [livre][chapitre][verset] = texte
// → [{ b, c, v, text, score }]  (0-based, au plus 3, le plus ressemblant d'abord)
const WINDOW = 40;        // derniers mots pris en compte
const MIN_WORDS = 5;      // en dessous, trop court pour reconnaître un verset
// Sensibilité : bi = nb de paires de mots consécutifs identiques (4 → 5 mots d'affilée), cover = part des mots du verset entendus
export const LEVELS = {
  strict: { bi: 5, cover: 0.9 },
  normal: { bi: 4, cover: 0.8 },
  souple: { bi: 3, cover: 0.7 },
};

export function findSimilarVerses(text, index, bible, level = "normal") {
  const { bi: MIN_BIGRAMS, cover: MIN_COVER } = LEVELS[level] || LEVELS.normal;
  if (!index || !bible) return [];
  const words = String(text || "").trim().split(/\s+/).slice(-WINDOW);
  const toks = tokenize(words.join(" "));
  if (toks.length < MIN_WORDS) return [];

  const spoken = new Set(toks);
  const spokenBi = new Set();
  for (let i = 0; i < toks.length - 1; i++) spokenBi.add(toks[i] + " " + toks[i + 1]);

  // candidats : les mots les plus longs (les plus discriminants) interrogent l'index
  const probe = [...new Set(toks)].filter((w) => w.length > 3 && !/^\d+$/.test(w)).sort((a, b) => b.length - a.length).slice(0, 14);
  if (probe.length < 2) return [];
  let cands = [];
  try { cands = index.search(probe.join(" ")); } catch { return []; }

  const out = [];
  for (const h of cands) {
    const verse = bible[h.b]?.[h.c]?.[h.v];
    if (!verse) continue;
    const vt = tokenize(verse);
    if (vt.length < 4) continue;
    let hit = 0, bi = 0;
    for (let i = 0; i < vt.length; i++) {
      if (spoken.has(vt[i])) hit++;
      if (i < vt.length - 1 && spokenBi.has(vt[i] + " " + vt[i + 1])) bi++;
    }
    const cover = hit / vt.length;
    const ok = bi >= MIN_BIGRAMS || (vt.length >= 6 && cover >= MIN_COVER && bi >= 2);
    if (!ok) continue;
    out.push({ b: h.b, c: h.c, v: h.v, text: verse, score: cover + bi / Math.max(1, vt.length - 1) });
  }
  out.sort((a, b) => b.score - a.score);
  // un résultat nettement moins bon que le premier n'est pas proposé (évite le bruit)
  return out.filter((x) => x.score >= out[0].score * 0.6).slice(0, 3);
}
