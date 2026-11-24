import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USFM } from "@/lib/usfmBooks";
import ONLINE from "@/config/online-versions.json";

// Passerelle vers l'API officielle YouVersion Platform. La clé (YVP_APP_KEY) reste sur le serveur.
//   GET /api/bible?action=versions
//   GET /api/bible?action=index&v=<id>            → nombre de versets par chapitre (66 livres)
//   GET /api/bible?action=chapter&v=<id>&b=42&c=2 → versets du chapitre (b, c : indices à partir de 0)
const API = "https://api.youversion.com/v1";
const KEY = process.env.YVP_APP_KEY;
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

const cache = new Map(); // mémoire du serveur : un chapitre déjà demandé ne rappelle pas YouVersion
const remember = (k, v) => { if (cache.size > 3000) cache.delete(cache.keys().next().value); cache.set(k, v); return v; };

async function yv(path) {
  const res = await fetch(`${API}${path}`, { headers: { "X-YVP-App-Key": KEY, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error(`YouVersion ${res.status} sur ${path}`), { status: res.status });
  return res.json();
}

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const clean = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+([,.;:!?»)])/g, "$1").replace(/\s+/g, " ").trim();

// Chapitre en HTML → { numéroDeVerset: texte }. Retourne null si les repères de versets sont introuvables.
function parseHtml(html) {
  const re = /<span[^>]*class="[^"]*\byv-v\b[^"]*"[^>]*\bv="(\d+)(?:-(\d+))?"[^>]*>\s*<\/span>/g;
  const marks = [...html.matchAll(re)];
  if (!marks.length) return null;
  const out = {};
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length;
    let chunk = html.slice(m.index + m[0].length, end);
    chunk = chunk.replace(/<span[^>]*class="[^"]*\byv-vlbl\b[^"]*"[^>]*>.*?<\/span>/g, ""); // numéro affiché
    out[+m[1]] = (out[+m[1]] ? out[+m[1]] + " " : "") + clean(chunk);
  });
  return out;
}

async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]); }
  }));
  return res;
}

async function chapter(yvId, code, c) {
  const ch = await yv(`/bibles/${yvId}/books/${code}/chapters/${c}`);
  const count = (ch.verses || []).length;
  let map = null;
  try {
    const p = await yv(`/bibles/${yvId}/passages/${code}.${c}?format=html&include_headings=false&include_notes=false`);
    map = parseHtml(p.content || "");
  } catch {}
  const ok = map && Array.from({ length: count }, (_, i) => map[i + 1]).filter(Boolean).length >= count * 0.9;
  if (!ok) { // secours sûr : un verset à la fois
    const nums = (ch.verses || []).map((v) => +v.id);
    const texts = await pool(nums, 6, async (n) => {
      const p = await yv(`/bibles/${yvId}/passages/${code}.${c}.${n}?format=text`);
      return clean(p.content || "");
    });
    map = {}; nums.forEach((n, i) => { map[n] = texts[i]; });
  }
  const max = Math.max(count, ...Object.keys(map).map(Number));
  return Array.from({ length: max }, (_, i) => map[i + 1] || "");
}

// ───── API.Bible (https://scripture.api.bible) : versions anglaises NLT, NKJV, CSB… (champ « ab » du fichier de config) ─────
const AB_KEY = process.env.API_BIBLE_KEY;
async function ab(path) {
  const res = await fetch(`https://api.scripture.api.bible/v1${path}`, { headers: { "api-key": AB_KEY, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error(`API.Bible ${res.status} sur ${path}`), { status: res.status });
  return res.json();
}
// chapitre en texte avec numéros « [1] … [2] … » → tableau de versets
async function abChapter(abId, code, c) {
  const j = await ab(`/bibles/${abId}/chapters/${code}.${c}?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`);
  const txt = String(j.data?.content || "");
  const parts = txt.split(/\[(\d+)\]/);   // [avant, n, texte, n, texte…]
  const map = {};
  for (let i = 1; i < parts.length; i += 2) {
    const n = +parts[i];
    const t = parts[i + 1].replace(/\s+/g, " ").trim();
    map[n] = map[n] ? map[n] + " " + t : t;
  }
  const max = Math.max(0, ...Object.keys(map).map(Number));
  if (!max) throw Object.assign(new Error("Chapitre vide ou illisible (API.Bible)."), { status: 502 });
  return Array.from({ length: max }, (_, i) => map[i + 1] || "");
}

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);

  const q = new URL(req.url).searchParams;
  const action = q.get("action");
  const configured = ONLINE.filter((v) => v.yv || (v.ab && AB_KEY));

  // Diagnostic : liste les Bibles françaises que la clé peut lire (accessible: true) ou qui demandent une licence (false)
  //   ouvrir /api/bible?action=catalog une fois connecté
  if (action === "catalog") {
    const lang = (q.get("lang") || "fr").replace(/[^a-z-]/gi, "").slice(0, 8) || "fr";   // ex. &lang=en pour l'anglais
    if (!KEY) return fail("YVP_APP_KEY absente sur ce déploiement.", 500);
    try {
      const list = async (all) => {
        const out = []; let token = "";
        do {
          const j = await yv(`/bibles?language_ranges[]=${lang}&page_size=99${all ? "&all_available=true" : ""}${token ? `&page_token=${encodeURIComponent(token)}` : ""}`);
          out.push(...(j.data || [])); token = j.next_page_token || "";
        } while (token);
        return out;
      };
      const [ok, all] = await Promise.all([list(false), list(true)]);
      const okIds = new Set(ok.map((b) => b.id));
      return NextResponse.json(all.map((b) => ({ id: b.id, abbreviation: b.abbreviation || "", title: b.title, accessible: okIds.has(b.id) })));
    } catch (e) { return fail(e.message, e.status || 502); }
  }

  if (action === "versions") {
    if (!KEY) return NextResponse.json([]);
    const out = [];
    for (const v of configured) {
      let copyright = "";
      try {
        if (v.ab) copyright = (await (cache.get("meta" + v.ab) ?? remember("meta" + v.ab, (await ab(`/bibles/${v.ab}`)).data || {}))).copyright || "";
        else copyright = (await (cache.get("meta" + v.yv) ?? remember("meta" + v.yv, await yv(`/bibles/${v.yv}`)))).copyright || "";
      } catch {}
      out.push({ id: v.id, label: v.label, full: v.full, lang: v.lang || "fr", online: true, copyright: String(copyright).replace(/^"|"$/g, "") });
    }
    return NextResponse.json(out);
  }

  if (!KEY) return fail("YVP_APP_KEY absente sur ce déploiement.", 500);
  const v = configured.find((x) => x.id === q.get("v"));
  if (!v) return fail("Version inconnue.", 404);

  try {
    if (action === "index") {
      // une version API.Bible n'a pas d'index : on prend celui d'une version YouVersion de même langue (même découpage en versets)
      const refId = v.yv || (ONLINE.find((x) => x.yv && x.lang === v.lang) || ONLINE.find((x) => x.yv))?.yv;
      const k = `idx${refId}`;
      if (cache.has(k)) return NextResponse.json(cache.get(k));
      const idx = await yv(`/bibles/${refId}/index`);
      const byId = Object.fromEntries((idx.books || []).map((b) => [b.id, b]));
      const counts = USFM.map((code) => (byId[code]?.chapters || []).map((c) => (c.verses || []).length));
      return NextResponse.json(remember(k, counts));
    }
    if (action === "chapter") {
      const b = +q.get("b"), c = +q.get("c");
      if (!(b >= 0 && b < 66) || !(c >= 0 && c < 200)) return fail("Référence invalide.");
      const k = `ch${v.ab || v.yv}.${b}.${c}`;
      if (cache.has(k)) return NextResponse.json(cache.get(k));
      return NextResponse.json(remember(k, v.ab ? await abChapter(v.ab, USFM[b], c + 1) : await chapter(v.yv, USFM[b], c + 1)));
    }
  } catch (e) {
    return fail(e.message, e.status === 401 || e.status === 403 ? 502 : e.status || 502);
  }
  return fail("Action inconnue.");
}
