"use client";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useLocale } from "@/lib/i18n/client";

// Image depuis internet (pour la régie technique) :
//  - on tape des mots (« Jérusalem », « mer de Galilée »…) → vignettes → un clic projette l'image
//  - ou on colle l'adresse d'une image : elle est projetée directement
// Rien n'est téléchargé ni enregistré dans l'appli : seul le lien voyage, l'écran charge l'image depuis son site d'origine.
const looksLikeUrl = (s) => /^https?:\/\//i.test(s) || /^(www\.)?[\w-]+(\.[\w-]+)+\/\S+/i.test(s);

const toUrl = (raw) => {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol === "http:") u.protocol = "https:";       // une page https ne peut pas afficher une image http
    return u.protocol === "https:" ? u : null;
  } catch { return null; }
};

const nameOf = (u) => {
  let last = "";
  try { last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || ""); } catch {}
  const host = u.hostname.replace(/^www\./, "");
  return (/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(last) ? `${host} · ${last}` : host).slice(0, 60);
};

// vérifie qu'une adresse est bien une image qui se charge (sinon l'écran ne serait pas touché)
const checkImage = (href) => new Promise((resolve) => {
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  const timer = setTimeout(() => resolve(false), 12000);
  img.onload = () => { clearTimeout(timer); resolve(true); };
  img.onerror = () => { clearTimeout(timer); resolve(false); };
  img.src = href;
});

export default function WebImage({ onProject, disabled, liveUrl, status }) {
  const tr = useT();
  const locale = useLocale();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);          // vérification d'un lien / d'une image choisie
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);             // { q, items, sources, google, page, more }
  const [bad, setBad] = useState(() => new Set());  // vignettes qui ne se chargent pas / images bloquées
  const [picking, setPicking] = useState(null);
  const run = useRef(0);

  const live = !!liveUrl;

  const project = async (href, name, tileId) => {
    if (disabled || busy) return;
    setErr(""); setBusy(true); setPicking(tileId || "link");
    const id = ++run.current;
    const ok = await checkImage(href);
    if (id !== run.current) return;
    setBusy(false); setPicking(null);
    if (ok) { onProject(href, name); return; }
    if (tileId) {
      setBad((b) => new Set(b).add(tileId));
      setErr(tr("wi.blocked"));
    } else {
      setErr(tr("wi.notDirect"));
    }
  };

  const search = async (q, page = 1) => {
    setErr(""); setSearching(true);
    const id = ++run.current;
    try {
      const r = await fetch(`/api/image-search?q=${encodeURIComponent(q)}&page=${page}&lang=${locale}`);
      const j = await r.json().catch(() => ({}));
      if (id !== run.current) return;
      if (!r.ok) throw new Error(j.error || tr("wi.error", { status: r.status }));
      setRes((cur) => {
        const prev = page > 1 && cur?.q === q ? cur.items : [];
        const seen = new Set(prev.map((x) => x.url));
        const items = [...prev, ...j.results.filter((x) => !seen.has(x.url))];
        return { q, items, sources: j.sources, web: j.web, notes: j.notes || [], page, more: j.results.length >= 10 && page < 5 };
      });
    } catch (e) {
      if (id === run.current) setErr(e.message);
    } finally {
      if (id === run.current) setSearching(false);
    }
  };

  const go = () => {
    const s = text.trim();
    if (!s || disabled) return;
    if (looksLikeUrl(s)) {
      const u = toUrl(s);
      if (!u) return setErr(tr("wi.pasteFull"));
      setRes(null);
      project(u.href, nameOf(u));
    } else {
      setBad(new Set());
      search(s, 1);
    }
  };

  const isLink = looksLikeUrl(text.trim());
  const items = (res?.items || []).filter((x) => !bad.has(x.id + "!thumb"));
  const failedStatus = live && status === "error";

  return (
    <div className="rounded-xl bg-sky-400/5 border border-sky-400/30 p-2.5 sm:p-3">
      <div className="flex gap-2">
        <input value={text} onChange={(e) => { setText(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } else if (e.key === "Escape") e.target.blur(); }}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={tr("wi.placeholder")}
          className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-sky-400" />
        <button onClick={go} disabled={!text.trim() || disabled || busy || searching}
          className="shrink-0 rounded-lg bg-sky-400 hover:bg-sky-300 text-black font-medium px-3 py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-70 disabled:pointer-events-none">
          {searching ? tr("wi.searching") : busy && picking === "link" ? tr("wi.checking") : isLink ? tr("wi.project") : tr("wi.search")}
        </button>
      </div>

      {err && <p className="mt-1.5 text-xs text-red-300 leading-5">{err}</p>}
      {!err && failedStatus && (
        <p className="mt-1.5 text-xs text-red-300 leading-5">{tr("wi.screenFail")}</p>
      )}

      {res && (
        <div className="mt-2">
          {!items.length && !searching ? (
            <p className="text-xs text-neutral-300 leading-5">{tr("wi.noResult", { q: res.q })}</p>
          ) : (
            <ul className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 max-h-[calc(100vh-17rem)] min-h-72 overflow-y-auto">
              {items.map((r) => {
                const on = liveUrl === r.url;
                return (
                  <li key={r.id}>
                    <button disabled={disabled || busy} onClick={() => project(r.url, (r.title || r.source).slice(0, 60), r.id)}
                      title={[r.title, r.credit && `© ${r.credit}`, r.license, r.source].filter(Boolean).join(" · ")}
                      className={`relative block w-full aspect-video overflow-hidden rounded-lg bg-neutral-800 transition duration-100 active:scale-95 disabled:pointer-events-none ${on ? "ring-2 ring-green-400" : bad.has(r.id) ? "opacity-30" : "hover:ring-2 ring-sky-400"}`}>
                      <img src={r.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false}
                        onError={() => setBad((b) => new Set(b).add(r.id + "!thumb"))}
                        className="w-full h-full object-cover" />
                      {picking === r.id && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px]">{tr("wi.loadingTile")}</span>}
                      {on && <span className="absolute left-1 top-1 rounded bg-green-600 text-[10px] px-1">{tr("kp.onScreen")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {res.more && (
              <button disabled={searching} onClick={() => search(res.q, res.page + 1)} className="text-xs text-sky-300 hover:underline disabled:opacity-50">{tr("wi.more")}</button>
            )}
            <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(res.q)}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-sky-300 hover:underline">{tr("wi.google")}</a>
            <button onClick={() => { setRes(null); setErr(""); }} className="ml-auto text-xs text-neutral-500 hover:text-white">{tr("common.close")}</button>
          </div>
          {res.notes?.length > 0 && <p className="mt-1 text-[11px] text-amber-300 leading-4">⚠ {res.notes.join(" · ")}</p>}
          <p className="mt-1 text-[11px] text-neutral-400 leading-4">
            {tr("wi.sources", { list: res.sources.join(", "), free: res.web ? "" : tr("wi.freeOnly") })}
          </p>
        </div>
      )}

      {!res && !err && !failedStatus && (
        <p className="mt-1.5 text-[11px] text-neutral-400 leading-4">{tr("wi.nothingSaved")}</p>
      )}
    </div>
  );
}
