// Lit un fichier .txt, .md ou .docx et renvoie du texte.
// Pour un chant en .docx : une ligne vide entre deux couplets sépare les diapositives.
// Pour une note en .docx : chaque paragraphe devient une diapositive.
import { hasRef } from "./refs";

const decode = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function readTextFile(file, kind = "notes") {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) return (await file.text()).replace(/^\uFEFF/, "");

  if (name.endsWith(".docx")) {
    const mod = await import("mammoth/mammoth.browser");
    const mammoth = mod.default || mod;
    const arrayBuffer = await file.arrayBuffer();
    if (kind === "chants") {
      const { value } = await mammoth.convertToHtml({ arrayBuffer }, { ignoreEmptyParagraphs: false });
      return decode(value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, ""));
    }
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  throw new Error("Format non pris en charge. Utilise .txt, .md ou .docx.");
}

// ───── Notes : texte + points clés repérés en gras ─────
// .docx : tout ce qui est en gras devient un point clé. .md : **gras**. .txt : aucun repère.
const REF_ONLY = /^\(?\s*[1-3]?\s*[A-Za-zÀ-ÿ]{2,}\.?\s*\d{1,3}\s*(?:[:.,]|\s+v(?:ers(?:et)?)?\.?\s*)\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*\)?\.?$/;
// Un verset n'est pas une phrase clé, même en gras : il est déjà repéré à part (« Versets de la note »).
// On écarte : une référence seule, un passage qui contient une référence, et un passage collé à une référence « (Jean 3:16) ».
const REF_AROUND = /^[\s«»"“”'’)\]—–:,.-]*\(?\s*[1-3]?\s*[A-Za-zÀ-ÿ]{2,}\.?\s*\d{1,3}\s*(?:[:.,]|\s+v(?:ers(?:et)?)?\.?\s*)\s*\d{1,3}/;
const REF_BEFORE = /[1-3]?\s*[A-Za-zÀ-ÿ]{2,}\.?\s*\d{1,3}\s*(?:[:.,]|\s+v(?:ers(?:et)?)?\.?\s*)\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*\)?[\s:—–«"“-]*$/;
const nearRef = (text, k) => {
  if (!text) return false;
  const flat = text.replace(/\s+/g, " ");
  const i = flat.indexOf(k);
  if (i < 0) return false;
  const after = flat.slice(i + k.length, i + k.length + 45);
  const before = flat.slice(Math.max(0, i - 45), i);
  return (REF_AROUND.test(after) && hasRef(after.slice(0, 45))) || (REF_BEFORE.test(before) && hasRef(before));
};
const cleanKeys = (list, text = "") => {
  const seen = new Set();
  return list
    .map((k) => decode(k).replace(/\s+/g, " ").trim())
    .filter((k) => k.length >= 6 && !REF_ONLY.test(k) && !hasRef(k) && !nearRef(text, k))
    .filter((k) => (seen.has(k) ? false : seen.add(k)))
    .slice(0, 40);
};

export async function readNoteFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return { text: (await file.text()).replace(/^\uFEFF/, ""), keys: [] };
  if (name.endsWith(".md")) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    return { text, keys: cleanKeys([...text.matchAll(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g)].map((m) => m[1] || m[2]), text) };
  }
  if (name.endsWith(".docx")) {
    const mod = await import("mammoth/mammoth.browser");
    const mammoth = mod.default || mod;
    const arrayBuffer = await file.arrayBuffer();
    const { value: text } = await mammoth.extractRawText({ arrayBuffer });
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, {
      styleMap: ["r[style-name='Strong'] => strong", "r[style-name='Accentuation forte'] => strong", "r[style-name='Gras'] => strong"],   // gras venant d'un style Word, pas seulement du bouton G
    });
    const joined = html.replace(/<\/strong>(\s*)<strong>/g, "$1");   // plusieurs morceaux gras côte à côte = une seule phrase
    const keys = cleanKeys([...joined.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")), text);
    return { text, keys };
  }
  throw new Error("Format non pris en charge. Utilise .txt, .md ou .docx.");
}
