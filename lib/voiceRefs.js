// Détection vocale (TEST) : repère une référence biblique dans une phrase prononcée.
// « Jean chapitre trois verset seize », « psaume cent dix-neuf », « première épître aux Corinthiens 13 », « Romains 8 28 à 30 »
// → [{ b, chapter, verse, vEnd }]   (chapter / verse 1-based ; verse = null si seul le chapitre est cité)
// Pour supprimer la fonction : effacer ce fichier, app/control/VoiceRefs.jsx et les 2 lignes « Voice » de app/control/page.jsx.
import { BOOKS, EN_BOOKS } from "./books";
import { fold } from "./textUtil";

const UNITS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9 };
const TEENS = { dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 };
const TENS = { vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
const ORD = { premier: "1", premiere: "1", "1er": "1", "1ere": "1", "1re": "1", deuxieme: "2", second: "2", seconde: "2", "2eme": "2", "2e": "2", troisieme: "3", "3eme": "3", "3e": "3" };
const SKIP = new Set(["chapitre", "chapitres", "verset", "versets", "epitre", "lettre", "livre", "evangile", "selon", "aux", "de", "du", "d", "l"]);
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
  if (w === "cent") { base = 100; j = i + 1; }
  else if (w in UNITS && UNITS[w] > 1 && t[i + 1] === "cent") { base = UNITS[w] * 100; j = i + 2; }
  if (base) {
    const r = below100(t, j);
    return r && r[0] > 0 ? [base + r[0], r[1]] : [base, j];
  }
  return below100(t, i);
}

// mots → chiffres : « trois seize » → « 3 16 », « chapitre » / « verset » retirés, « à » entre deux nombres → « - »
function toTokens(text) {
  // « à » (de 16 à 18) se distingue de « a » (il a) avant la suppression des accents
  let s = fold(String(text).replace(/(^|\s)[àÀ](?=\s|$)/g, " ZZTO ")).replace(/['’`]/g, " ").replace(/(\d)\s*[-–]\s*(\d)/g, "$1 zzto $2").replace(/(\d)\s*[:.,]\s*(\d)/g, "$1 $2").replace(/[-–]/g, " ");
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
[["isaie", 22], ["ezechiel", 25], ["psaume", 18], ["actes des apotres", 43], ["apocalypse de jean", 65], ["cantique", 21]].forEach(([n, i]) => addName(n, i));
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
