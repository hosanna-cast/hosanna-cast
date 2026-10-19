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

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);

  const q = new URL(req.url).searchParams;
  const action = q.get("action");
  const configured = ONLINE.filter((v) => v.yv);

  if (action === "versions") {
    if (!KEY) return NextResponse.json([]);
    const out = [];
    for (const v of configured) {
      let copyright = "";
      try { copyright = (await (cache.get("meta" + v.yv) ?? remember("meta" + v.yv, await yv(`/bibles/${v.yv}`)))).copyright || ""; } catch {}
      out.push({ id: v.id, label: v.label, full: v.full, online: true, copyright: String(copyright).replace(/^"|"$/g, "") });
    }
    return NextResponse.json(out);
  }

  if (!KEY) return fail("YVP_APP_KEY absente sur ce déploiement.", 500);
  const v = configured.find((x) => x.id === q.get("v"));
  if (!v) return fail("Version inconnue.", 404);

  try {
    if (action === "index") {
      const k = `idx${v.yv}`;
      if (cache.has(k)) return NextResponse.json(cache.get(k));
      const idx = await yv(`/bibles/${v.yv}/index`);
      const byId = Object.fromEntries((idx.books || []).map((b) => [b.id, b]));
      const counts = USFM.map((code) => (byId[code]?.chapters || []).map((c) => (c.verses || []).length));
      return NextResponse.json(remember(k, counts));
    }
    if (action === "chapter") {
      const b = +q.get("b"), c = +q.get("c");
      if (!(b >= 0 && b < 66) || !(c >= 0 && c < 200)) return fail("Référence invalide.");
      const k = `ch${v.yv}.${b}.${c}`;
      if (cache.has(k)) return NextResponse.json(cache.get(k));
      return NextResponse.json(remember(k, await chapter(v.yv, USFM[b], c + 1)));
    }
  } catch (e) {
    return fail(e.message, e.status === 401 || e.status === 403 ? 502 : e.status || 502);
  }
  return fail("Action inconnue.");
}
