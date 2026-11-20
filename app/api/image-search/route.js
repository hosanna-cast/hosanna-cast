import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recherche d'images sur internet pour la régie technique :
//   GET /api/image-search?q=jérusalem&page=1
// Sources (toutes interrogées depuis le serveur, aucune clé à mettre dans le navigateur) :
//   - Wikimedia Commons : gratuit, sans clé, images libres de droits
//   - Openverse         : gratuit, sans clé, images sous licence libre (Creative Commons / domaine public)
//   - Serper (= vrais résultats Google Images) : OPTIONNEL, si SERPER_API_KEY est défini (voir README)
//   - Brave Search (images du web)             : OPTIONNEL, si BRAVE_API_KEY est défini (voir README)
//   (l'ancienne API « Google Custom Search » est fermée aux nouveaux comptes et s'arrête le 1er janvier 2027)
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

// Vrais résultats Google Images, via Serper (https://serper.dev, 2 500 recherches gratuites à l'inscription)
async function serper(q, page) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const r = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ q, gl: "fr", hl: "fr", num: 20, page }),
    signal: AbortSignal.timeout(7000), cache: "no-store",
  });
  if (!r.ok) throw new Error(`Serper HTTP ${r.status}`);
  const j = await r.json();
  return (j.images || []).map((x) => ({
    id: "sp:" + x.imageUrl, thumb: https(x.thumbnailUrl) || https(x.imageUrl), url: https(x.imageUrl),
    title: strip(x.title), credit: "", license: "", source: strip(x.source || x.domain) || "Google Images",
    w: x.imageWidth, h: x.imageHeight, page: https(x.link),
  })).filter((x) => x.thumb && x.url);
}

// Images du web via Brave Search (https://brave.com/search/api, offre gratuite limitée)
async function brave(q, page) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;
  const u = new URL("https://api.search.brave.com/res/v1/images/search");
  u.search = new URLSearchParams({ q, count: String(Math.min(100, page * 20)), country: "fr", search_lang: "fr", safesearch: "strict", spellcheck: "1" });
  const r = await fetch(u, { headers: { "X-Subscription-Token": key, Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!r.ok) throw new Error(`Brave HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).slice((page - 1) * 20, page * 20).map((x) => ({
    id: "br:" + (x.properties?.url || x.url), thumb: https(x.thumbnail?.src) || https(x.properties?.url), url: https(x.properties?.url),
    title: strip(x.title), credit: "", license: "", source: strip(x.source) || "Brave",
    w: x.properties?.width, h: x.properties?.height, page: https(x.url),
  })).filter((x) => x.thumb && x.url);
}

// ordre : les résultats « web » (Google/Brave) d'abord, comme sur Google ; les images libres de droits
// (Commons, Openverse) viennent ensuite, mélangées entre elles, sans doublon
function merge(web, free) {
  const out = [], seen = new Set();
  const add = (x) => { if (x && !seen.has(x.url)) { seen.add(x.url); out.push(x); } };
  web.forEach((l) => l.forEach(add));
  for (let i = 0; free.some((l) => i < l.length); i++) for (const l of free) add(l[i]);
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

  const jobs = [
    { name: "Google Images", web: true, run: () => serper(q, page) },
    { name: "Brave", web: true, run: () => brave(q, page) },
    { name: "Wikimedia Commons", web: false, run: () => commons(q, page) },
    { name: "Openverse", web: false, run: () => openverse(q, page) },
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const used = [], web = [], free = [];
  settled.forEach((s, i) => {
    if (s.status === "rejected") console.warn("image-search:", jobs[i].name, s.reason?.message);
    if (s.status === "fulfilled" && s.value) { used.push(jobs[i].name); (jobs[i].web ? web : free).push(s.value); }
  });
  if (!used.length) return fail("La recherche d'images est indisponible pour le moment. Réessaie, ou colle le lien d'une image.", 502);

  const results = merge(web, free);
  const hasWeb = web.length > 0;
  return NextResponse.json(remember(key, { results, sources: used, web: hasWeb, google: hasWeb }));
}
