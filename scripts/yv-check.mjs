// Outil de contrôle YouVersion (à lancer sur votre ordinateur, avec votre clé) :
//   YVP_APP_KEY=xxxx node scripts/yv-check.mjs              → liste les Bibles françaises visibles avec votre clé
//   YVP_APP_KEY=xxxx node scripts/yv-check.mjs 152 JHN.3    → affiche le chapitre brut d'une version (pour vérifier)
const KEY = process.env.YVP_APP_KEY;
if (!KEY) { console.error("Définissez YVP_APP_KEY (clé de platform.youversion.com)."); process.exit(1); }
const get = async (path) => {
  const r = await fetch(`https://api.youversion.com/v1${path}`, { headers: { "X-YVP-App-Key": KEY, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} ${path}\n${await r.text()}`);
  return r.json();
};

const [, , id, passage] = process.argv;
if (id && passage) {
  const p = await get(`/bibles/${id}/passages/${passage}?format=html&include_headings=false&include_notes=false`);
  console.log(p.reference, "\n", p.content);
  process.exit(0);
}

for (const all of [false, true]) {
  console.log(all ? "\n=== TOUTES les Bibles françaises (licence peut-être à accepter sur le site) ===" : "=== Bibles françaises accessibles avec votre clé ===");
  let token = "";
  do {
    const j = await get(`/bibles?language_ranges[]=fr&page_size=99${all ? "&all_available=true" : ""}${token ? `&page_token=${encodeURIComponent(token)}` : ""}`);
    for (const b of j.data || []) console.log(String(b.id).padEnd(7), (b.abbreviation || "").padEnd(8), b.title);
    token = j.next_page_token || "";
  } while (token);
}
console.log("\nCopiez les numéros voulus dans config/online-versions.json (champ \"yv\").");
