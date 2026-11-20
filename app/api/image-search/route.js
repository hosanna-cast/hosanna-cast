import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recherche d'images sur internet pour la régie technique :
//   GET /api/image-search?q=jérusalem&page=1
// Sources (toutes interrogées depuis le serveur, aucune clé à mettre dans le navigateur) :
//   - Wikimedia Commons : gratuit, sans clé, images libres de droits
//   - Openverse         : gratuit, sans clé, images sous licence libre (Creative Commons / domaine public)
//   - Google            : OPTIONNEL, seulement si GOOGLE_CSE_KEY et GOOGLE_CSE_CX sont définis (voir README)
const UA = "HosannaCast/1.0 (projection d'eglise)";
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

const cache = new Map();   // mémoire du serveur : la même recherche, vite répétée, n'appelle pas les sources
const remember = (k, v) => { if (cache.size > 200) cache.delete(cache.keys().next().value); cache.set(k, { v, t: Date.now() }); return v; };
const TTL = 10 * 60 * 1000;

const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const https = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function commons(q, page) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6",
    gsrlimit: "20", gsroffset: String((page - 1) * 20), prop: "imageinfo", iiprop: "url|size|extmetadata",
    iiurlwidth: "320", iiextmetadatafilter: "Artist|LicenseShortName",
  });
  const j = await getJson(u);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.map((p) => {
    const i = p.imageinfo?.[0];
    if (!i) return null;
    // image d'écran : l'original s'il est raisonnable, sinon une version réduite à 1920 px de large
    const full = (i.width || 0) <= 1920 ? i.url : String(i.thumburl || "").replace(/\/\d+px-(?=[^/]*$)/, "/1920px-");
    return {
      id: "wc:" + p.pageid, thumb: https(i.thumburl) || https(i.url), url: https(full),
      title: p.title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " "),
      credit: strip(i.extmetadata?.Artist?.value), license: strip(i.extmetadata?.LicenseShortName?.value),
      source: "Wikimedia Commons", w: i.width, h: i.height, page: https(i.descriptionurl),
    };
  }).filter((x) => x && x.thumb && x.url);
}

const licOf = (l, v) => (!l ? "" : l === "cc0" ? "CC0" : l === "pdm" ? "Domaine public" : `CC ${String(l).toUpperCase()}${v ? " " + v : ""}`);

async function openverse(q, page) {
  const u = new URL("https://api.openverse.org/v1/images/");
  u.search = new URLSearchParams({ q, page: String(page), page_size: "20", mature: "false" });
  const j = await getJson(u);
  return (j.results || []).map((r) => ({
    id: "ov:" + r.id, thumb: https(r.thumbnail) || https(r.url), url: https(r.url),
    title: strip(r.title), credit: strip(r.creator), license: licOf(r.license, r.license_version),
    source: "Openverse", w: r.width, h: r.height, page: https(r.foreign_landing_url),
  })).filter((x) => x.thumb && x.url);
}

async function google(q, page) {
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return null;
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.search = new URLSearchParams({ key, cx, q, searchType: "image", num: "10", start: String(Math.min(91, (page - 1) * 10 + 1)), safe: "active" });
  const j = await getJson(u);
  return (j.items || []).map((r) => ({
    id: "g:" + r.link, thumb: https(r.image?.thumbnailLink) || https(r.link), url: https(r.link),
    title: strip(r.title), credit: "", license: "", source: "Google", w: r.image?.width, h: r.image?.height, page: https(r.image?.contextLink),
  })).filter((x) => x.thumb && x.url);
}

// mélange les sources une à une (1 de Google, 1 de Commons, 1 d'Openverse, puis on recommence), sans doublon
function interleave(lists) {
  const out = [], seen = new Set();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (l[i] && !seen.has(l[i].url)) { seen.add(l[i].url); out.push(l[i]); }
  }
  return out;
}

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise.", 401);

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const page = Math.min(5, Math.max(1, parseInt(sp.get("page") || "1", 10) || 1));
  if (q.length < 2) return fail("Tape au moins 2 lettres.");

  const key = `${q.toLowerCase()}|${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return NextResponse.json(hit.v);

  const names = ["Google", "Wikimedia Commons", "Openverse"];
  const settled = await Promise.allSettled([google(q, page), commons(q, page), openverse(q, page)]);
  const used = [], lists = [];
  settled.forEach((s, i) => { if (s.status === "fulfilled" && s.value) { used.push(names[i]); lists.push(s.value); } });
  if (!used.length) return fail("La recherche d'images est indisponible pour le moment. Réessaie, ou colle le lien d'une image.", 502);

  const results = interleave(lists);
  return NextResponse.json(remember(key, { results, sources: used, google: !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) }));
}
