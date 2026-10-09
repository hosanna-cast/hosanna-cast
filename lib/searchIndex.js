import MiniSearch from "minisearch";
import { tokenize, makeCorrector } from "./textUtil";

const CHUNK = 1500;                                   // versets traités avant de rendre la main au navigateur
const tick = () => new Promise((r) => setTimeout(r, 0));

// Construit l'index de recherche par mots d'une Bible [livre][chapitre][verset] = texte.
// Retourne { search(q) } : tolère accents, pluriels, fautes courantes, lettres inversées.
export async function buildIndexAsync(data) {
  const ms = new MiniSearch({
    fields: ["t"],
    storeFields: ["b", "c", "v", "t"],
    tokenize: (s) => tokenize(s),
    processTerm: (t) => t,
  });
  const vocab = new Map();
  let batch = [];

  for (let b = 0; b < data.length; b++) {
    for (let c = 0; c < data[b].length; c++) {
      const vs = data[b][c];
      for (let v = 0; v < vs.length; v++) {
        const t = vs[v];
        if (!t) continue;
        batch.push({ id: `${b}.${c}.${v}`, b, c, v, t });
        for (const w of tokenize(t)) vocab.set(w, (vocab.get(w) || 0) + 1);
        if (batch.length >= CHUNK) { ms.addAll(batch); batch = []; await tick(); }
      }
    }
  }
  if (batch.length) ms.addAll(batch);
  const correct = makeCorrector(vocab);

  return {
    search(q) {
      let terms = tokenize(q);
      const long = terms.filter((t) => t.length > 2);      // « a », « le », « de » ne bloquent plus la recherche
      if (long.length) terms = long;
      terms = terms.map(correct);
      if (!terms.length) return [];
      const query = terms.join(" ");
      let res = ms.search(query, { prefix: true, combineWith: "AND" });
      if (!res.length && terms.length > 1) {                // seconde passe : versets contenant le plus de mots
        res = ms.search(query, { prefix: true, combineWith: "OR" });
      }
      return res.slice(0, 8);
    },
  };
}
