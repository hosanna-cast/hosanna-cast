// Exécuté avant chaque build (prebuild). Génère public/bible/<nom>.json
// pour chaque version, puis public/bible/versions.json (liste des versions OK).
// Ajouter une version = ajouter un bloc dans VERSIONS.
import AdmZip from "adm-zip";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const VERSIONS = [
  { name: "lsg", label: "LSG", full: "Louis Segond 1910", ids: ["fraLSG"], match: /segond/i },
  { name: "ostervald", label: "OST", full: "Ostervald", ids: ["fraOST", "fra_fob", "fraFOB"], match: /ostervald/i },
  { name: "darby", label: "DBY", full: "Darby", ids: ["fraDBY", "fra_dby", "fraDarby"], match: /darby/i },
  { name: "martin", label: "MAR", full: "Martin 1744", ids: ["fraMAR", "fra_mar", "fraMartin"], match: /martin/i },
  { name: "kjv", label: "KJV", full: "King James Version", lang: "eng", ids: ["eng-kjv2006", "engkjv", "eng-kjv"], match: /king james/i },
];
const BASES = ["https://ebible.org/Scriptures/", "https://ebible.org/Bible/"];

const count = (file) => JSON.parse(fs.readFileSync(file, "utf8")).flat(2).filter(Boolean).length;

function parseCSV(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Catalogue officiel eBible : retrouve l'identifiant d'une traduction par son titre (une langue à la fois)
const catalogs = {};
async function catalogIds(rx, lang = "fra") {
  if (!catalogs[lang]) {
    catalogs[lang] = [];
    try {
      const res = await fetch("https://ebible.org/Scriptures/translations.csv");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseCSV(await res.text());
      const h = rows[0].map((s) => s.trim());
      const iId = h.indexOf("translationId"), iLang = h.indexOf("languageCode");
      if (iId < 0) throw new Error("colonne translationId introuvable");
      for (const r of rows.slice(1)) {
        if (iLang >= 0 && r[iLang] !== lang) continue;
        catalogs[lang].push({ id: r[iId], text: r.join(" ") });
      }
      console.log(`  catalogue ${lang} :`, catalogs[lang].map((c) => c.id).join(", "));
    } catch (e) { console.warn("  catalogue indisponible :", e.message); }
  }
  return catalogs[lang].filter((c) => rx.test(c.text)).map((c) => c.id);
}

async function download(v) {
  const tried = new Set();
  const attempt = async (id) => {
    for (const base of BASES) {
      const url = `${base}${id}_usfm.zip`;
      if (tried.has(url)) continue;
      tried.add(url);
      try {
        const res = await fetch(url);
        if (!res.ok) { console.warn(`  ${res.status} ${url}`); continue; }
        return { buf: Buffer.from(await res.arrayBuffer()), url };
      } catch (e) { console.warn(`  échec ${url} : ${e.message}`); }
    }
    return null;
  };
  for (const id of v.ids) { const r = await attempt(id); if (r) return r; }
  for (const id of await catalogIds(v.match, v.lang || "fra")) { const r = await attempt(id); if (r) return r; }
  return null;
}

fs.mkdirSync("public/bible", { recursive: true });
const done = [];
const skipped = [];

for (const v of VERSIONS) {
  const out = `public/bible/${v.name}.json`;
  console.log(`== ${v.full} (${v.name})`);
  if (!fs.existsSync(out)) {
    const dl = await download(v);
    if (!dl) { console.warn(`  -> ${v.full} ignorée (téléchargement impossible)`); skipped.push(v.full); continue; }
    console.log("  téléchargé :", dl.url);
    try {
      const dir = `usfm/${v.name}`;
      new AdmZip(dl.buf).extractAllTo(dir, true);
      execFileSync("node", ["scripts/usfm-to-json.mjs", dir, out], { stdio: "inherit" });
    } catch (e) { console.warn("  conversion échouée :", e.message); skipped.push(v.full); continue; }
  }
  if (!fs.existsSync(out) || count(out) < 20000) {
    console.warn(`  -> ${v.full} ignorée (fichier incomplet)`);
    fs.rmSync(out, { force: true });
    skipped.push(v.full);
    continue;
  }
  done.push({ id: v.name, label: v.label, full: v.full });
}

if (!done.length) { console.error("Aucune Bible générée."); process.exit(1); }
fs.writeFileSync("public/bible/versions.json", JSON.stringify(done));
console.log("Versions disponibles :", done.map((d) => d.label).join(", "));
if (skipped.length) console.warn("VERSIONS IGNORÉES :", skipped.join(", "));
