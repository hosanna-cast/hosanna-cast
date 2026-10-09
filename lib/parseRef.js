import { matchBooks, isAlias, BOOKS, EN_BOOKS } from "./books";
import { fold } from "./textUtil";

const ROMAN = { i: 1, ii: 2, iii: 3 };

// « I Jean », « 2ème Timothée », « 1ère Pierre » → « 1 Jean », « 2 Timothée », « 1 Pierre »
function prep(input) {
  let s = input.trim();
  s = s.replace(/^(iii|ii|i)\.?\s+(?=[a-zà-ÿ])/i, (_, r) => ROMAN[r.toLowerCase()] + " ");
  s = s.replace(/^([1-3])\s*(?:ère|ere|er|re|ème|eme|e|nde|nd)\b\.?\s*(?=[a-zà-ÿ])/i, "$1 ");
  return s;
}

// « jn 3 16 », « jean 3:16-18 », « 1 co 13 », « j316 », « jn 3 v 16 » → { books:[idx], chapter, verse, verseEnd }
export function parseRef(input) {
  const m = prep(input).match(
    /^([1-3]?\s*[a-zA-ZÀ-ÿ]+)\.?\s*(\d+)?(?:(?:\s*[:.,]\s*|\s+(?:v|vs|ver|verset|verse)\.?\s*|\s+)(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i
  );
  if (!m) return null;
  let books = matchBooks(m[1]);
  if (!books.length) return null;
  let chapter = m[2] ? +m[2] : null;
  let verse = m[3] ? +m[3] : null;
  // un mot seul, sans chapitre (« fils », « amour »), n'est un livre que s'il commence vraiment comme lui
  // ou si c'est une abréviation connue ; sinon c'est une recherche par mots
  if (chapter === null && !isAlias(m[1])) {
    const raw = fold(m[1]).replace(/[^a-z0-9]/g, "");
    books = books.filter((i) => [BOOKS[i], EN_BOOKS[i]].some((n) => {
      const k = fold(n).replace(/[^a-z0-9]/g, "");
      return k.startsWith(raw) || k.replace(/^\d/, "").startsWith(raw);   // « samuel » → 1 Samuel
    }));
    if (!books.length) return null;
  }
  // saisie collée "j316" : chapitre 316 impossible (max 150) → 3 / 16
  if (chapter > 150 && !verse) {
    const s = String(chapter);
    verse = +s.slice(-2);
    chapter = +s.slice(0, -2);
  }
  return { books, chapter, verse, verseEnd: m[4] ? +m[4] : null };
}
