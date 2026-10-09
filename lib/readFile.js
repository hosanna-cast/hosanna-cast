// Lit un fichier .txt, .md ou .docx et renvoie du texte.
// Pour un chant en .docx : une ligne vide entre deux couplets sépare les diapositives.
// Pour une note en .docx : chaque paragraphe devient une diapositive.
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
