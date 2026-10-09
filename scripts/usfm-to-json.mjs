// Usage: node scripts/usfm-to-json.mjs <dossier_usfm> [sortie.json]
// Convertit une Bible USFM (ex. eBible.org fraLSG) en [livre][chapitre][verset] = texte
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const out = process.argv[3] || "public/bible/lsg.json";
if (!dir) { console.error("Usage: node scripts/usfm-to-json.mjs <dossier_usfm> [sortie.json]"); process.exit(1); }

const ORDER = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");

const clean = (s) => s
  .replace(/\\f\s.*?\\f\*/gs, "")                                  // notes de bas de page
  .replace(/\\x\s.*?\\x\*/gs, "")                                  // références croisées
  .replace(/\\\+?w\s+([^|\\]*)(\|[^\\]*)?\\\+?w\*/g, "$1")           // mots avec Strong : \w et \+w (imbriqué)
  .replace(/\\\+?[a-z0-9]+\*?/gi, " ")                               // autres marqueurs inline, y compris \+xxx
  .replace(/\|[a-z-]+="[^"]*"/gi, "")                                // attributs restants (strong="G1063")
  .replace(/\\/g, " ")                                              // aucun antislash ne doit rester
  .replace(/\s+([,.;:!?»)])/g, "$1")                                 // espaces avant ponctuation collée par le nettoyage
  .replace(/\s+/g, " ").trim();

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(dir).filter((f) => /\.(usfm|sfm)$/i.test(f));
const books = {};

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "");
  const id = raw.match(/\\id\s+([A-Z0-9]{3})/)?.[1];
  if (!id || !ORDER.includes(id)) continue;
  const chapters = [];
  let ch = -1, v = -1, skip = false;
  for (const line of raw.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^\\c\s+(\d+)/))) { ch = +m[1] - 1; chapters[ch] = []; v = -1; skip = false; continue; }
    if (ch < 0) continue;
    if ((m = line.match(/^\\v\s+(\d+)(?:-(\d+))?\s*(.*)$/))) {
      v = +m[1] - 1; skip = false;
      chapters[ch][v] = clean(m[3]);
      continue;
    }
    if (/^\\(s\d?|r|d|ms\d?|mr|sp|b|rem|h|toc\d|mt\d?)(\s|$)/.test(line)) { skip = true; continue; } // titres
    if (/^\\(p|q\d?|m|pi\d?|li\d?|nb|mi)(\s|$)/.test(line)) { skip = false; }
    if (!skip && v >= 0) {
      const extra = clean(line.replace(/^\\[a-z0-9]+\s*/i, ""));
      if (extra) chapters[ch][v] = ((chapters[ch][v] || "") + " " + extra).trim();
    }
  }
  books[id] = chapters.map((c) => (c || []).map((t) => t || ""));
}

const result = ORDER.map((id) => books[id] || []);
const missing = ORDER.filter((id) => !books[id]);
const total = result.flat(2).filter(Boolean).length;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result));
console.log(`OK : ${total} versets écrits dans ${out}`);
if (missing.length) console.warn("Livres manquants :", missing.join(", "));
