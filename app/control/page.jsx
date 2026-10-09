"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKS } from "@/lib/books";
import { parseRef } from "@/lib/parseRef";
import { useBible } from "@/lib/useBible";
import { useLibrary, slidesOf } from "@/lib/library";
import LibraryPanel from "./LibraryPanel";
import ChantStage from "./ChantStage";
import ChapterView from "./ChapterView";
import { useChurch } from "@/lib/church";
import UserMenu from "./UserMenu";
import { openScreen } from "@/lib/screen";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import { tabsFor } from "@/lib/roles";

const Kbd = ({ children }) => (
  <kbd className="px-2 py-0.5 rounded-md border border-blue-400/60 text-blue-300 text-xs font-sans whitespace-nowrap">{children}</kbd>
);

export default function Control() {
  const church = useChurch();
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState([{ id: "lsg", label: "LSG", full: "Louis Segond 1910" }]);
  const [version, setVersion] = useState("lsg");
  const { bible, index, loaded, loading } = useBible(version);
  const library = useLibrary();
  const [chantId, setChantId] = useState(null);
  const [view, setView] = useState(null);                // chapitre affiché au centre { b, c }
  const [cite, setCite] = useState(null);                // plage citée dans la note { b, c, v, vEnd }
  const tabs = tabsFor(church.role);                        // onglets autorisés pour ce profil (« Chants » : chants seulement)
  const [tab, setTab] = useState(tabs[0]);                // "bible" | "notes" | "chants"
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [wide, setWide] = useState(false);               // ordinateur : le chapitre est lu au centre, pas dans le panneau de gauche
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const f = () => setWide(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const [typing, setTyping] = useState(false);            // champ de recherche actif (clavier du téléphone ouvert)
  const [live, setLive] = useState(null);                 // dernier verset projeté (indices)
  const [slideLive, setSlideLive] = useState(null);       // dernière diapositive projetée { kind, id, i }
  const [liveKind, setLiveKind] = useState("verse");      // "verse" | "slide" : ce que ← → font avancer
  const [shown, setShown] = useState(null);               // exactement ce qui est envoyé à l'écran
  const [blank, setBlank] = useState(false);
  const [history, setHistory] = useState([]);
  const [peers, setPeers] = useState([]);                  // les autres opérateurs connectés
  const [lastBy, setLastBy] = useState(null);              // dernière action faite par quelqu'un d'autre { name, device, what }
  const [rPulse, setRPulse] = useState(false);
  const mine = useRef(null);
  const stateRef = useRef({});
  const [pulse, setPulse] = useState(false);
  const [nav, setNav] = useState({ b: null, c: null });   // livre / chapitre ouverts dans la Bible
  const anchor = useRef(null);
  const panel = useRef(null);
  const ch = useRef(null);
  const searchRef = useRef(null);
  const prevLoaded = useRef(null);

  // autofocus seulement sur ordinateur : sur téléphone, le clavier cacherait l'écran
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) searchRef.current?.focus();
  }, [tab]);

  stateRef.current = { shown, live, slideLive, liveKind, blank };

  // Plusieurs personnes peuvent piloter le même écran : chaque console reçoit ce que les autres projettent,
  // donc tout le monde voit la même chose à l'écran et ← → repartent du bon endroit.
  // On ne déplace PAS la lecture de l'autre (sa Bible reste où il la consulte).
  useEffect(() => {
    const me = { id: uuid(), name: church.firstName || church.email.split("@")[0], device: window.matchMedia("(min-width: 1024px)").matches ? "ordinateur" : "mobile" };
    mine.current = me;
    const applyState = (m) => {
      if (m.shown !== undefined) setShown(m.shown);
      setLive(m.r || null);
      setSlideLive(m.s || null);
      if (m.liveKind) setLiveKind(m.liveKind);
      if (m.blank !== undefined) setBlank(m.blank);
    };
    const onRemote = (m) => {
      const who = m.by ? { name: m.by.name, device: m.by.device } : null;
      const noted = (what) => { if (who) { setLastBy({ ...who, what }); setRPulse(true); setTimeout(() => setRPulse(false), 700); } };
      if (m.type === "show" || m.type === "update") {
        setShown({ type: m.type, kind: m.kind, ref: m.ref, text: m.text, version: m.version });
        if (m.type === "show") setBlank(false);
        if (m.r) {
          setLive(m.r); setLiveKind("verse");
          if (m.type === "show") setHistory((h) => [m.r, ...h.filter((x) => !(x.b === m.r.b && x.c === m.r.c && x.v === m.r.v && x.vEnd === m.r.vEnd))].slice(0, 15));
        } else if (m.s) { setSlideLive(m.s); setLiveKind("slide"); }
        else if (m.free) setLiveKind("free");
        if (m.type === "show") noted(m.ref);
      } else if (m.type === "clear") {
        setLive(null); setSlideLive(null); setShown(null);
        noted("a effacé l'écran");
      } else if (m.type === "blank") {
        setBlank(m.on === undefined ? (b) => !b : m.on);
        noted(m.on === false ? "a réaffiché l'écran" : "a mis l'écran en noir");
      } else if (m.type === "sync?") {
        // quelqu'un vient d'ouvrir la console : on lui dit ce qui est à l'écran
        const st = stateRef.current;
        if (st.shown || st.blank) ch.current?.postMessage({ type: "state", to: m.by?.id, shown: st.shown, r: st.live, s: st.slideLive, liveKind: st.liveKind, blank: st.blank });
      } else if (m.type === "state" && m.to === me.id) applyState(m);
    };
    ch.current = openScreen(church.token, onRemote, {
      me,
      onPeers: (list) => setPeers(list.filter((p) => p.id !== me.id).filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)),
      onReady: () => ch.current?.postMessage({ type: "sync?" }),
    });
    return () => ch.current.close();
  }, [church.token]);
  const screenUrl = () => `${location.origin}/display?k=${church.token}`;
  const copyScreen = () => navigator.clipboard?.writeText(screenUrl()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const logout = async () => { await createClient().auth.signOut(); location.href = "/login"; };

  // /control?tab=notes ou /control?tab=chants (liens de la page d'accueil)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if ((t === "notes" || t === "chants") && tabs.includes(t)) setTab(t);
  }, []);

  // liste des versions réellement générées au build
  useEffect(() => {
    fetch("/bible/versions.json").then((r) => r.json()).then((list) => {
      if (!Array.isArray(list) || !list.length) return;
      setVersions(list);
      setVersion((cur) => (list.some((v) => v.id === cur) ? cur : list[0].id));
    }).catch(() => {});
  }, []);

  const label = versions.find((v) => v.id === loaded)?.label ?? (loaded || version).toUpperCase();

  const results = useMemo(() => {
    if (!bible || !q.trim()) return [];
    const ref = parseRef(q);
    if (ref) {
      return ref.books.slice(0, 6).map((b) => {
        const c = ref.chapter ? ref.chapter - 1 : 0;
        const v = ref.verse ? ref.verse - 1 : 0;
        const text = bible[b]?.[c]?.[v];
        if (text === undefined) return null;
        return { b, c, v, vEnd: ref.verseEnd ? ref.verseEnd - 1 : null, t: text };
      }).filter(Boolean);
    }
    return index ? index.search(q).slice(0, 8) : [];
  }, [q, bible, index]);

  useEffect(() => setSel(0), [q]);

  // la Bible de gauche suit le verset projeté
  useEffect(() => {
    if (wide || !live || !panel.current) return;
    const el = document.getElementById(`v-${live.b}-${live.c}-${live.v}`);
    if (el) panel.current.scrollTo({ top: Math.max(0, el.offsetTop - 140), behavior: "smooth" });
  }, [live, wide]);

  const textOf = (r) => {
    const vs = bible?.[r.b]?.[r.c];
    if (!vs) return "";
    const end = Math.min(r.vEnd ?? r.v, vs.length - 1);
    return vs.slice(r.v, end + 1).map((t, i) => (end > r.v ? `${r.v + i + 1} ` : "") + t).join(" ");
  };
  const refOf = (r) => `${BOOKS[r.b]} ${r.c + 1}:${r.v + 1}${r.vEnd && r.vEnd > r.v ? "-" + (r.vEnd + 1) : ""}`;

  const flash = () => { setLastBy(null); setPulse(true); setTimeout(() => setPulse(false), 250); };

  const project = (r, citeRange) => {
    setView({ b: r.b, c: r.c });
    setCite((prev) => (citeRange !== undefined ? citeRange : prev && prev.b === r.b && prev.c === r.c ? prev : null));
    const msg = { type: "show", ref: refOf(r), text: textOf(r), version: label, r };
    setLive(r);
    setLiveKind("verse");
    setShown(msg);
    setBlank(false);
    setNav({ b: r.b, c: r.c });
    setHistory((h) => [r, ...h.filter((x) => refOf(x) !== refOf(r))].slice(0, 15));
    ch.current?.postMessage(msg);
    flash();
  };

  // diapositive d'une note ou d'un chant
  const projectSlide = (kind, item, i, slides) => {
    const msg = { type: "show", kind: kind === "chants" ? "chant" : "slide", ref: `${item.title} · ${i + 1}/${slides.length}`, text: slides[i], version: "", s: { kind, id: item.id, i } };
    setSlideLive({ kind, id: item.id, i });
    setLiveKind("slide");
    setShown(msg);
    setBlank(false);
    ch.current?.postMessage(msg);
    flash();
  };

  // texte libre (le chantre change une parole) : projeté tel quel, on reste dessus
  const projectFree = (item, text) => {
    const msg = { type: "show", kind: "chant", ref: `${item.title} · texte libre`, text, version: "", free: true };
    setLiveKind("free");
    setShown(msg);
    setBlank(false);
    ch.current?.postMessage(msg);
    flash();
  };

  const clearScreen = () => {
    setQ("");
    ch.current?.postMessage({ type: "clear" });
    setLastBy(null);
    setLive(null);
    setSlideLive(null);
    setShown(null);
  };
  // « noir » est explicite (on / off) : si deux personnes appuient, l'écran ne bascule pas dans le mauvais sens
  const toggleBlank = () => { const on = !blank; ch.current?.postMessage({ type: "blank", on }); setBlank(on); setLastBy(null); };

  // changement de version : le verset à l'écran est re-projeté dans la nouvelle version
  const reproject = (r) => {
    if (!bible?.[r.b]?.[r.c]?.[r.v]) return;           // verset absent de cette version : l'écran reste tel quel
    const msg = { type: "update", ref: refOf(r), text: textOf(r), version: label, r };
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  useEffect(() => {
    if (!bible || !loaded) return;
    if (prevLoaded.current && prevLoaded.current !== loaded && live && liveKind === "verse") reproject(live);
    prevLoaded.current = loaded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const go = (n) => {
    anchor.current = null; setNav(n); panel.current?.scrollTo({ top: 0 });
    if (n.b !== null && n.c !== null) setView({ b: n.b, c: n.c });   // le chapitre choisi à gauche s'affiche au centre
  };
  const pickVerse = (b, c, v, e) => {
    if (e.shiftKey && anchor.current && anchor.current.b === b && anchor.current.c === c) {
      const a = anchor.current.v;
      project({ b, c, v: Math.min(a, v), vEnd: Math.max(a, v) });
    } else {
      anchor.current = { b, c, v };
      project({ b, c, v, vEnd: null });
    }
  };
  const isLive = (b, c, v) => liveKind === "verse" && live && live.b === b && live.c === c && v >= live.v && v <= (live.vEnd ?? live.v);
  // un verset cité dans une note ou un chant : on projette le premier, puis → passe au suivant (un verset à la fois)
  const projectFirst = (r) => project({ ...r, vEnd: null }, { b: r.b, c: r.c, v: r.v, vEnd: r.vEnd ?? r.v });
  const isLiveVerse = (r) => liveKind === "verse" && live && live.b === r.b && live.c === r.c && live.v >= r.v && live.v <= (r.vEnd ?? r.v);

  const onSlides = liveKind === "slide" || liveKind === "free";
  const canStep = onSlides ? !!slideLive : !!live;
  const step = (d) => {
    if (onSlides) {
      if (!slideLive) return;
      const item = library.lib[slideLive.kind].find((x) => x.id === slideLive.id);
      if (!item) return;
      const slides = slidesOf(item);
      const i = slideLive.i + d;
      if (i >= 0 && i < slides.length) projectSlide(slideLive.kind, item, i, slides);
      return;
    }
    if (!live || !bible) return;
    const vs = bible[live.b][live.c];
    const v = (live.vEnd ?? live.v) + d;
    if (v >= 0 && v < vs.length) project({ b: live.b, c: live.c, v, vEnd: null });
  };

  const onKey = (e) => {
    const t = e.target;
    // on tape dans le formulaire d'une note : les raccourcis ne s'appliquent pas
    if (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t !== searchRef.current)) {
      if (e.key === "Escape") t.blur();
      return;
    }
    const inField = t === searchRef.current;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "b") { e.preventDefault(); toggleBlank(); }
    else if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { project(results[sel]); setQ(""); }
    else if (e.key === "Escape") clearScreen();
    else if (!q && e.key === "ArrowRight") step(1);
    else if (!q && e.key === "ArrowLeft") step(-1);
    else if (!q && !inField && k === "b") toggleBlank();
  };

  const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";
  const size = shown ? (shown.text.length < 110 ? "text-sm sm:text-lg" : shown.text.length < 220 ? "text-xs sm:text-base" : "text-xs sm:text-sm") : "";
  const chapters = nav.b !== null ? bible?.[nav.b] : null;

  return (
    <main className={`min-h-screen bg-neutral-900 text-white p-3 sm:p-6 2xl:px-10 ${typing ? "pb-[55vh] lg:pb-6" : ""}`} onKeyDown={onKey}>
      {/* barre du haut */}
      <header className="flex items-center justify-between gap-3 mb-3 sm:mb-5">
        <a href="/" title="Accueil" className="inline-flex items-center gap-2.5 transition duration-100 active:scale-95">
          <img src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="text-xl sm:text-2xl font-semibold leading-none">Hosanna <span className="text-amber-400">Cast</span></span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {peers.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-neutral-800 border border-neutral-700 pl-2 pr-1 py-1" title={peers.map((p) => `${p.name} (${p.device})`).join(", ") + " : connecté aussi"}>
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="hidden sm:inline text-xs text-neutral-300">{peers.length === 1 ? peers[0].name : `${peers.length} autres`}</span>
              {peers.slice(0, 3).map((p) => (
                <span key={p.id} className="h-6 w-6 rounded-full bg-sky-500/80 text-[11px] font-medium text-black flex items-center justify-center">{(p.name || "?").charAt(0).toUpperCase()}</span>
              ))}
            </div>
          )}
          <UserMenu church={church} copied={copied} onCopy={copyScreen} onLogout={logout} />
        </div>
      </header>

      <div className="grid gap-3 lg:gap-5 lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_380px] 2xl:grid-cols-[380px_minmax(0,1fr)_480px] items-start">

        {/* ───── gauche : Bible, notes, chants ───── */}
        <section className="order-3 lg:order-1 lg:sticky lg:top-6">
          {tabs.length > 1 && (
          <div className="flex gap-1 bg-neutral-800 rounded-lg p-1 mb-1.5 sm:mb-2">
            {[["bible", "Bible"], ["notes", "Notes"], ["chants", "Chants"]].filter(([k]) => tabs.includes(k)).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm transition duration-100 active:scale-95 ${tab === k ? "bg-neutral-600 text-white font-medium" : "text-neutral-400 hover:text-white"}`}>{l}</button>
            ))}
          </div>
          )}

          {tabs.includes("bible") && (
          <div className="flex gap-0.5 bg-neutral-800 rounded-md p-0.5 mb-1.5 sm:mb-2">
            {versions.map((v) => (
              <button key={v.id} onClick={() => setVersion(v.id)} title={v.full}
                className={`flex-1 px-2.5 py-1 rounded text-xs transition duration-100 active:scale-95 ${version === v.id ? "bg-amber-400 text-black font-medium " + (loading ? "animate-pulse" : "") : "text-neutral-400 hover:text-white"}`}>
                {v.label}
              </button>
            ))}
          </div>
          )}

          <div ref={panel} className="relative bg-neutral-800/60 border border-neutral-700 rounded-xl p-2 sm:p-3 max-h-[55vh] lg:max-h-[calc(100vh-7.5rem)] overflow-y-auto">
            {tab !== "bible" ? (
              <LibraryPanel
                key={tab}
                kind={tab}
                items={library.lib[tab]}
                ready={library.ready}
                onAdd={(item) => library.add(tab, item)}
                onRemove={(id) => library.remove(tab, id)}
                onUpdate={(id, patch) => library.update(tab, id, patch)}
                onPick={setChantId}
                selectedId={chantId}
                bible={bible}
                refOf={refOf}
                textOf={textOf}
                pausedSlide={liveKind !== "slide" ? slideLive : null}
                isLiveVerse={isLiveVerse}
                liveSlide={liveKind === "slide" ? slideLive : null}
                onSlide={(item, i, slides) => projectSlide(tab, item, i, slides)}
                onVerse={projectFirst}
              />
            ) : !bible ? (
              <p className="text-sm text-neutral-500">Chargement de la Bible…</p>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-sm mb-3 flex-wrap">
                  <button onClick={() => go({ b: null, c: null })} className={nav.b === null ? "font-medium" : "text-amber-400 hover:underline"}>Livres</button>
                  {nav.b !== null && (<><span className="text-neutral-600">›</span>
                    <button onClick={() => go({ b: nav.b, c: null })} className={nav.c === null ? "font-medium" : "text-amber-400 hover:underline"}>{BOOKS[nav.b]}</button></>)}
                  {nav.c !== null && (<><span className="text-neutral-600">›</span><span className="font-medium">{nav.c + 1}</span></>)}
                </div>

                {nav.b === null && [["Ancien Testament", 0, 39], ["Nouveau Testament", 39, 66]].map(([title, from, to]) => (
                  <div key={title} className="mb-4">
                    <h3 className="text-xs text-neutral-500 mb-2">{title}</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BOOKS.slice(from, to).map((name, i) => (
                        <button key={name} onClick={() => go({ b: from + i, c: null })}
                          className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 active:bg-amber-400 active:text-black text-sm text-left truncate transition duration-100">{name}</button>
                      ))}
                    </div>
                  </div>
                ))}

                {nav.b !== null && nav.c === null && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {(chapters || []).map((_, c) => (
                      <button key={c} onClick={() => go({ b: nav.b, c })}
                        className="py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 active:bg-amber-400 active:text-black text-sm transition duration-100">{c + 1}</button>
                    ))}
                  </div>
                )}

                {wide && nav.b !== null && nav.c !== null && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {(chapters || []).map((_, c) => (
                      <button key={c} onClick={() => go({ b: nav.b, c })}
                        className={`py-1.5 rounded-lg active:scale-95 text-sm transition duration-100 ${c === nav.c ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 hover:bg-neutral-700"}`}>{c + 1}</button>
                    ))}
                  </div>
                )}

                {!wide && nav.b !== null && nav.c !== null && chapters?.[nav.c] && (
                  <div>
                    <div className="flex justify-between gap-2 mb-2 text-sm">
                      <button disabled={nav.c === 0} onClick={() => go({ b: nav.b, c: nav.c - 1 })} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30">‹ {nav.c}</button>
                      <button disabled={nav.c >= chapters.length - 1} onClick={() => go({ b: nav.b, c: nav.c + 1 })} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30">{nav.c + 2} ›</button>
                    </div>
                    <p className="hidden lg:block text-[11px] text-neutral-500 mb-2">Clic = projeter · Maj+clic = plusieurs versets</p>
                    <ul className="space-y-1">
                      {chapters[nav.c].map((t, v) => (
                        <li key={v} id={`v-${nav.b}-${nav.c}-${v}`} onClick={(e) => pickVerse(nav.b, nav.c, v, e)} title={t}
                          className={`px-2.5 py-2 rounded-lg cursor-pointer select-none text-sm leading-snug transition duration-100 active:scale-[0.98] ${isLive(nav.b, nav.c, v) ? "bg-green-600 text-white" : "text-neutral-300 hover:bg-neutral-700"}`}>
                          <b className={`mr-1.5 font-medium ${isLive(nav.b, nav.c, v) ? "text-green-100" : "text-neutral-500"}`}>{v + 1}</b>
                          <span className="line-clamp-2 inline">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ───── centre : recherche de versets (toujours disponible) ───── */}
        {tab === "chants" ? (
        <section className="order-2 min-w-0">
          <ChantStage
            item={library.lib.chants.find((x) => x.id === chantId) || null}
            bible={bible}
            refOf={refOf}
            textOf={textOf}
            isLiveVerse={isLiveVerse}
            liveSlide={liveKind === "slide" && slideLive?.kind === "chants" ? slideLive : null}
            pausedSlide={liveKind !== "slide" && slideLive?.kind === "chants" ? slideLive : null}
            onFree={projectFree}
            onSlide={(item, i, slides) => projectSlide("chants", item, i, slides)}
            onVerse={projectFirst}
            onUpdate={(id, patch) => library.update("chants", id, patch)}
            onRemove={(id) => { library.remove("chants", id); setChantId(null); }}
          />
        </section>
        ) : (
        <section className="order-2 min-w-0">
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              setTyping(true);
              // téléphone : on remonte le champ en haut pour que les résultats restent au-dessus du clavier
              if (!window.matchMedia("(min-width: 1024px)").matches)
                setTimeout(() => searchRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 350);
            }}
            onBlur={() => setTyping(false)}
            placeholder={bible ? "jn 3 16  •  tant aimé le monde" : "Chargement de la Bible…"}
            className="w-full text-base sm:text-xl p-2.5 sm:p-3.5 rounded-xl bg-neutral-800 outline-none focus:ring-2 ring-amber-400" />

          <ul className="mt-2 lg:mt-3 space-y-1 max-h-[36vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
            {results.map((r, i) => (
              <li key={i} onClick={() => { project(r); setQ(""); searchRef.current?.blur(); }}
                className={`p-2.5 sm:p-3 rounded-lg cursor-pointer select-none transition duration-100 active:scale-[0.98] active:brightness-125 ${i === sel ? "bg-amber-400 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                <b className="font-medium">{refOf(r)}</b>{" "}
                <span className={i === sel ? "text-black/70" : "text-neutral-400"}>{textOf(r).slice(0, 140)}</span>
              </li>
            ))}
          </ul>

          {!q.trim() && bible && (view && bible[view.b]?.[view.c] ? (
            wide ? <div>
            <ChapterView
              verses={bible[view.b][view.c]}
              title={BOOKS[view.b]}
              label={label}
              chapter={view.c}
              chapterCount={bible[view.b].length}
              live={liveKind === "verse" && live && live.b === view.b && live.c === view.c ? live.v : null}
              cite={cite && cite.b === view.b && cite.c === view.c ? cite : null}
              onPick={(v, e) => pickVerse(view.b, view.c, v, e)}
              onChapter={(d) => { setView({ b: view.b, c: view.c + d }); setNav({ b: view.b, c: view.c + d }); }}
            />
            </div> : null
          ) : (
            <p className="hidden lg:block mt-4 text-sm text-neutral-500 leading-6">
              Tape une référence (<span className="text-neutral-300">jn 3 16</span>, <span className="text-neutral-300">1 co 13</span>) ou quelques mots du verset.
              Le prédicateur cite un autre verset ? Cherche-le ici, ta note reste ouverte à gauche.
            </p>
          ))}
          {q.trim() && bible && !results.length && (
            <p className="mt-3 text-sm text-neutral-500">{index ? "Aucun résultat. Essaie d'autres mots." : "Préparation de la recherche…"}</p>
          )}
        </section>
        )}

        {/* ───── droite : l'écran (en premier sur mobile) ───── */}
        <aside className="order-1 lg:order-3 lg:sticky lg:top-6">
          <div className={`relative h-28 sm:h-auto sm:aspect-video rounded-xl bg-black border transition-all duration-300 ${pulse ? "border-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.35)]" : rPulse ? "border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.4)]" : "border-neutral-700"}`}>
            <span className={`hidden sm:block absolute top-2 left-3 text-xs ${blank ? "text-neutral-400" : shown ? "text-green-400" : "text-neutral-500"}`}>
              {blank ? "● Écran noir" : shown ? "● À l'écran" : "○ Rien à l'écran"}
            </span>
            {shown && !blank && (
              <div className="absolute inset-0 flex flex-col px-3 sm:px-5 pt-2 sm:pt-8 pb-2 sm:pb-3 overflow-y-auto">
                <div className="my-auto">
                {shown.kind === "chant" ? (
                  <>
                    <p className={`font-sans font-bold leading-snug whitespace-pre-line text-center ${size}`}>{shown.text}</p>
                  </>
                ) : (
                  <>
                    <p className={`font-serif leading-snug whitespace-pre-line ${shown.kind === "slide" ? "text-center" : ""} ${size}`}>{shown.text}</p>
                    <div className="mt-2 text-right text-sm text-amber-400">{shown.ref} <span className="text-xs text-neutral-500">{shown.version}</span></div>
                  </>
                )}
                </div>
              </div>
            )}
          </div>

          {peers.length > 0 && (
            <p className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 ${lastBy ? "bg-sky-500/15 text-sky-200" : "bg-neutral-800 text-neutral-400"}`}>
              {lastBy ? <><b className="font-medium">{lastBy.name}</b> <span className="opacity-70">({lastBy.device})</span> · {lastBy.what}</> : "C'est vous qui pilotez l'écran"}
            </p>
          )}

          <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 lg:gap-2 mt-2 lg:mt-3">
            <button className={btn} disabled={!canStep} onClick={() => step(-1)}>← Préc.</button>
            <button className={btn} disabled={!canStep} onClick={() => step(1)}>Suiv. →</button>
            <button onClick={toggleBlank}
              className={`rounded-lg py-2 text-sm transition duration-100 active:scale-95 ${blank ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 hover:bg-neutral-700"}`}>Noir</button>
            <button className={btn} disabled={!shown} onClick={clearScreen}>Effacer</button>
          </div>

          <div className="hidden lg:flex mt-4 flex-col items-center gap-2.5 text-xs xl:text-sm text-neutral-400">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5"><Kbd>↑↓</Kbd> choisir</span>
              <span className="flex items-center gap-1.5"><Kbd>Entrée</Kbd> projeter</span>
              <span className="flex items-center gap-1.5"><Kbd>←→</Kbd> naviguer</span>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5"><Kbd>Échap</Kbd> effacer</span>
              <span className="flex items-center gap-1.5"><Kbd>Ctrl+B</Kbd> écran noir</span>
            </div>
          </div>

          {history.length > 0 && (
            <section className="mt-3 lg:mt-4">
              <h2 className="hidden lg:block text-xs text-neutral-500 mb-2">Derniers versets</h2>
              <div className="flex flex-wrap gap-1.5">
                {history.map((r, i) => (
                  <button key={i} onClick={() => project(r)}
                    className="px-2.5 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs transition duration-100 active:scale-90 active:bg-amber-400 active:text-black">
                    {refOf(r)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
