import { fold, phonWord, dist, maxEdits } from "./textUtil";

export const BOOKS = ["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"];

export const EN_BOOKS = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];

// clé de comparaison : sans accents, espaces ni ponctuation, orthographe simplifiée
const key = (s) => phonWord(fold(s).replace(/[^a-z0-9]/g, ""));
export const norm = key;

const FR_KEYS = BOOKS.map(key);
const EN_KEYS = EN_BOOKS.map(key);

// abréviations courantes (français et anglais)
const RAW = {
  0: ["gn", "gen", "ge"], 1: ["ex", "exo", "exod"], 2: ["lv", "lev"], 3: ["nb", "nm", "num"], 4: ["dt", "deut", "deu"],
  5: ["jos", "josh"], 6: ["jg", "jug", "judg", "jdg"], 7: ["rt", "ru"], 8: ["1s", "1sa", "1sam"], 9: ["2s", "2sa", "2sam"],
  10: ["1r", "1rs", "1ki", "1kgs"], 11: ["2r", "2rs", "2ki", "2kgs"], 12: ["1ch", "1chr"], 13: ["2ch", "2chr"],
  14: ["esd", "ezr"], 15: ["ne", "neh"], 16: ["est", "esth"], 17: ["jb"], 18: ["ps", "psa", "pss"], 19: ["pr", "prv", "prov"],
  20: ["ec", "ecc", "eccl", "qo"], 21: ["ct", "cant", "sg", "song", "sos"], 22: ["es", "esa", "is", "isa"],
  23: ["jr", "jer"], 24: ["lm", "lam"], 25: ["ez", "eze", "ezek"], 26: ["dn", "dan"], 27: ["os", "hos"], 28: ["jl", "joel"],
  29: ["am", "amos"], 30: ["ab", "abd", "obad", "ob"], 31: ["jon", "jonah"], 32: ["mi", "mic"], 33: ["na", "nah"],
  34: ["ha", "hab"], 35: ["so", "sph", "zeph", "zep"], 36: ["ag", "hag"], 37: ["za", "zec", "zech"], 38: ["ml", "mal"],
  39: ["mt", "mat", "matt"], 40: ["mc", "mr", "mk", "mrk"], 41: ["lc", "lu", "lk", "luk"], 42: ["jn", "jhn", "joh"],
  43: ["ac", "act"], 44: ["rm", "ro", "rom"], 45: ["1co", "1cor"], 46: ["2co", "2cor"], 47: ["ga", "gal"], 48: ["ep", "eph"],
  49: ["ph", "php", "phil", "pp"], 50: ["col"], 51: ["1th", "1thes", "1thess"], 52: ["2th", "2thes", "2thess"],
  53: ["1tm", "1ti", "1tim"], 54: ["2tm", "2ti", "2tim"], 55: ["tt", "tit"], 56: ["phm", "phlm", "philem"],
  57: ["he", "heb", "hb"], 58: ["jc", "jas", "jac"], 59: ["1p", "1pi", "1pe", "1pet"], 60: ["2p", "2pi", "2pe", "2pet"],
  61: ["1jn", "1jhn", "1joh"], 62: ["2jn", "2jhn", "2joh"], 63: ["3jn", "3jhn", "3joh"], 64: ["jud", "jd"],
  65: ["ap", "apoc", "rev"],
};
const ALIAS = new Map();
Object.entries(RAW).forEach(([i, list]) => list.forEach((a) => ALIAS.set(key(a), +i)));

const RAW_ALIASES = new Set(Object.values(RAW).flat().map((a) => fold(a).replace(/[^a-z0-9]/g, "")));
// vrai seulement si la saisie est telle quelle une abréviation connue (pas une simple ressemblance)
export const isAlias = (typed) => RAW_ALIASES.has(fold(typed).replace(/[^a-z0-9]/g, ""));

// livres les plus projetés : passent en premier quand la saisie est ambiguë
const POP = [42, 18, 44, 39, 41, 43, 0, 19, 22, 48, 57, 65, 40, 45, 49, 46, 47, 50, 58, 59];
const pop = (i) => { const p = POP.indexOf(i); return p < 0 ? 100 + i : p; };

// retourne les index de livres correspondant à ce que l'utilisateur tape, du plus probable au moins probable
export function matchBooks(typed) {
  const t = key(typed);
  if (!t) return [];
  if (ALIAS.has(t)) return [ALIAS.get(t)];

  const exact = [];
  for (let i = 0; i < BOOKS.length; i++) if (FR_KEYS[i] === t || EN_KEYS[i] === t) exact.push(i);
  if (exact.length) return exact;

  const hasNum = /^\d/.test(t);
  const out = new Map(); // index → rang (plus petit = meilleur)
  const add = (i, rank) => { if (!out.has(i) || out.get(i) > rank) out.set(i, rank); };

  for (let i = 0; i < BOOKS.length; i++) {
    for (const k of [FR_KEYS[i], EN_KEYS[i]]) {
      if (k.startsWith(t)) add(i, 1);
      else if (!hasNum && /^\d/.test(k) && k.slice(1).startsWith(t)) add(i, 2); // « samuel » → 1 et 2 Samuel
    }
  }

  if (!out.size && t.length >= 3) {                      // fautes de frappe / lettres inversées
    const max = maxEdits(t.length);
    for (let i = 0; i < BOOKS.length; i++) {
      for (const k0 of [FR_KEYS[i], EN_KEYS[i]]) {
        const k = !hasNum && /^\d/.test(k0) ? k0.slice(1) : k0;
        let d = dist(t, k);
        if (k.length > t.length) d = Math.min(d, dist(t, k.slice(0, t.length)) + 0.5);
        if (d <= max) add(i, 10 + d);
      }
    }
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1] || pop(a[0]) - pop(b[0])).map((e) => e[0]);
}
