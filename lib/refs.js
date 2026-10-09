import { BOOKS } from "./books";
import { parseRef } from "./parseRef";
import { fold } from "./textUtil";

// « Jean 3:16 », « 1 Co 13.4-7 », « Rom. 8,28 », « Ps 23 v 1 »
const RE = /(\b[1-3]\s*)?([A-Za-zÀ-ÿ]{2,})\.?\s*(\d{1,3})\s*(?:[:.,]|\s+v(?:ers(?:et)?)?\.?\s*)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
const key = (s) => fold(s).replace(/[^a-z0-9]/g, "");

// Retourne [{ b, c, v, vEnd }] (indices), sans doublons, dans l'ordre du texte.
// Seuls les versets qui existent vraiment dans la Bible chargée sont gardés.
export function findRefs(text, bible) {
  if (!text || !bible) return [];
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(RE)) {
    const name = (m[1] ? m[1].trim() + " " : "") + m[2];
    const ref = parseRef(`${name} ${m[3]}:${m[4]}${m[5] ? "-" + m[5] : ""}`);
    if (!ref || !ref.chapter || !ref.verse) continue;
    const b = ref.books.length === 1 ? ref.books[0] : (ref.books.find((i) => key(BOOKS[i]) === key(name)) ?? null);
    if (b === null) continue;
    const vs = bible[b]?.[ref.chapter - 1];
    if (!vs || !vs[ref.verse - 1]) continue;
    const end = ref.verseEnd && ref.verseEnd > ref.verse ? Math.min(ref.verseEnd, vs.length) : null;
    const r = { b, c: ref.chapter - 1, v: ref.verse - 1, vEnd: end ? end - 1 : null };
    const k = `${r.b}.${r.c}.${r.v}.${r.vEnd ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
