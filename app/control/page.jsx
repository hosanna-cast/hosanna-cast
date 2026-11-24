"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BOOKS } from "@/lib/books";
import { parseRef } from "@/lib/parseRef";
import { useBible } from "@/lib/useBible";
import { useLibrary, slidesOf } from "@/lib/library";
import ChapterView from "./ChapterView";
import QuickText from "./QuickText";
import WebImage from "./WebImage";
import { useAnnoncesUi, AnnoncesAdd, AnnoncesSections, AnnoncesGrid } from "./AnnoncesPanel";
import { bgStyle } from "./Backgrounds";
import { useChurch } from "@/lib/church";
import UserMenu from "./UserMenu";
import { DEFAULT_SETTINGS, mergeSettings, loadSettings, saveSettings, loadLogo, saveLogo } from "@/lib/displaySettings";
import { fetchChurchSettings, migrateLegacy, appliedOf, watchChurchSettings, cacheLocally } from "@/lib/churchSettings";
import { useT } from "@/lib/i18n/client";
import { usePlaylists } from "@/lib/playlists";
import { useAnnouncements } from "@/lib/announcements";
import { openScreen } from "@/lib/screen";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import { tabsFor } from "@/lib/roles";
import { RichText, toggleRange } from "@/lib/bold";
import { USFM } from "@/lib/usfmBooks";
import { buildSnapshot } from "@/lib/screenProtocol";
import { pagesOfRange } from "@/lib/paginate";
import { useServicePlans } from "@/lib/servicePlan";
import { PlanAdd, PlanList } from "./PlanCulte";
import { findSimilarVerses } from "@/lib/voiceRefs";
import VersionSelect from "./VersionSelect";
import OverlayVerse from "./OverlayVerse";
import ChantBar from "./ChantBar";
import ColsText from "@/lib/ColsText";
import VoiceRefs from "./VoiceRefs";        // Voice (test) : détection vocale, supprimable
import ONLINE from "@/config/online-versions.json";

// versions à ouvrir sur bible.com (champ "web" = numéro dans l'adresse bible.com/bible/NUMÉRO/...)
const WEB_VERSIONS = ONLINE.filter((v) => v.web);

// panneaux chargés seulement quand on en a besoin (onglet ouvert, profil admin) : le premier affichage de la console est plus léger
const LibraryPanel = dynamic(() => import("./LibraryPanel"));
const ChantStage = dynamic(() => import("./ChantStage"));
const AnnonceStage = dynamic(() => import("./AnnonceStage"));
const HelpControl = dynamic(() => import("./HelpControl"));

const Kbd = ({ children }) => (
  <kbd className="px-2 py-0.5 rounded-md border border-blue-400/60 text-blue-300 text-xs font-sans whitespace-nowrap">{children}</kbd>
);

export default function Control() {
  const church = useChurch();
  const tr = useT();                                       // textes dans la langue choisie (FR / EN)
  const [copied, setCopied] = useState(false);
  const [copiedObs, setCopiedObs] = useState(false);
  const [versions, setVersions] = useState([{ id: "lsg", label: "LSG", full: "Louis Segond 1910" }]);
  const [version, setVersion] = useState("lsg");
  const online = !!versions.find((v) => v.id === version)?.online;   // version servie par l'API YouVersion
  const { bible, index, loaded, loading, error: bibleError, ensureChapter, chapterReady } = useBible(version, online);
  // comparaison de 2 versions : 2e colonne de lecture au centre (ordinateur)
  const [compare, setCompare] = useState(false);
  const [version2, setVersion2] = useState("");
  const [liveBoth, setLiveBoth] = useState(false);            // l'écran montre les 2 versions côte à côte (bouton « Afficher sur l'écran »)
  const online2 = !!versions.find((v) => v.id === version2)?.online;
  const { bible: bible2, loaded: loaded2, error: bibleError2, ensureChapter: ensureChapter2, chapterReady: chapterReady2 } = useBible(compare ? version2 : null, online2);
  const pendingProject = useRef(null);
  const pendingReproject = useRef(null);
  const library = useLibrary();
  const playlists = usePlaylists();                      // playlists de chants (effacées après 3 jours)
  const ann = useAnnouncements();                        // annonces : photos et vidéos (effacées après 3 jours)
  const annUi = useAnnoncesUi(ann);                    // état commun : formulaire d'ajout (gauche) et grille (centre)
  const [mediaLive, setMediaLive] = useState(null);       // dernière annonce projetée { id }
  const [mediaStatus, setMediaStatus] = useState(null);   // ce que l'écran dit de la vidéo : playing | muted | error
  const [chantId, setChantId] = useState(null);
  const [plId, setPlId] = useState(null);                   // playlist de chants active (barre « chant en cours »)
  const [view, setView] = useState(null);                // chapitre affiché au centre { b, c }
  const [cite, setCite] = useState(null);                // plage citée dans la note { b, c, v, vEnd }
  const allTabs = tabsFor(church.role);                     // onglets autorisés pour ce profil (« Chants » : chants seulement)
  const [tab, setTab] = useState(allTabs[0]);                // "bible" | "notes" | "chants" | "annonces" | "plan"
  const [showWeb, setShowWeb] = useState(false);          // panneau « Image depuis internet » (bouton à droite des onglets)
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const leftHidden = false;                                   // le bouton « Panneau » a été retiré : le panneau de gauche est toujours affiché
  const [stageEl, setStageEl] = useState(null);               // zone du centre où s'ouvre la note (onglet Notes)
  const [wide, setWide] = useState(false);               // ordinateur : le chapitre est lu au centre, pas dans le panneau de gauche
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const f = () => setWide(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  // sur téléphone, seul l'administrateur voit le plan du culte (l'aide écran et l'orateur n'en ont pas besoin)
  const tabs = allTabs.filter((k) => !(k === "plan" && church.role !== "admin" && !wide));
  useEffect(() => { if (!tabs.includes(tab)) setTab(tabs[0]); }, [wide]);   // eslint-disable-line react-hooks/exhaustive-deps

  const [typing, setTyping] = useState(false);            // champ de recherche actif (clavier du téléphone ouvert)
  const [live, setLive] = useState(null);                 // dernier verset projeté (indices)
  const [slideLive, setSlideLive] = useState(null);       // dernière diapositive projetée { kind, id, i }
  const [liveKind, setLiveKind] = useState("verse");      // "verse" | "slide" : ce que ← → font avancer
  const [livePage, setLivePage] = useState(0);            // page du passage projeté (passage long découpé en pages, voir lib/paginate.js)
  const [planActive, setPlanActive] = useState(null);      // élément du plan de culte en cours
  const [shown, setShown] = useState(null);               // exactement ce qui est envoyé à l'écran
  const [blank, setBlank] = useState(false);
  const [layout, setLayout] = useState("full");            // « full » = plein écran, « band » = bandeau en bas (temps de prière, direct)
  const [dset, setDset] = useState(DEFAULT_SETTINGS);                 // réglages de l'écran (bandeau / plein écran)
  const [logo, setLogo] = useState(null);                              // logo PNG de l'écran
  const [history, setHistory] = useState([]);
  const [screenBg, setScreenBg] = useState(null);                       // fond réellement affiché à l'écran
  const [screenText, setScreenText] = useState(null);                   // couleur du texte à l'écran (null = blanc)
  const [screens, setScreens] = useState([]);              // écrans de projection connectés (présence)
  const [screenOk, setScreenOk] = useState(null);          // l'écran confirme-t-il ce qu'on lui envoie ? null = pas encore su
  const [net, setNet] = useState("connecting");            // connexion internet du canal d'écran : online | connecting | offline
  const synced = useRef(false);                            // cette console connaît-elle l'état de l'écran ? (sinon elle ne répond pas aux demandes d'état)
  const [peers, setPeers] = useState([]);                  // les autres opérateurs connectés
  const [lastBy, setLastBy] = useState(null);              // dernière action faite par quelqu'un d'autre { name, device, what }
  const [rPulse, setRPulse] = useState(false);
  const [helperIds, setHelperIds] = useState([]);        // les personnes autorisées à projeter avec l'admin : une Aide écran et un Orateur au maximum
  const [helpBusy, setHelpBusy] = useState(false);
  const [noteId, setNoteId] = useState(null);                // note ouverte dans l'onglet Notes (pour y garder des phrases clés)
  const [hint, setHint] = useState(null);                  // petit message (ex. « sélectionne des mots pour le gras »)
  const selRef = useRef(null);                             // dernière sélection faite dans l'aperçu : { start, end }
  const previewTxt = useRef(null);                         // le texte affiché dans l'aperçu de l'écran
  // un profil « Aide écran » ne peut projeter que si l'administrateur l'a choisi
  // le profil Orateur ne gère ni le texte rapide, ni la mise en page (plein écran / bandeau / réglages) : c'est l'administrateur qui s'en occupe
  const isOrateur = church.role === "orateur";
  const canProject = !["assistant", "orateur"].includes(church.role) || helperIds.includes(church.userId);
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

  stateRef.current = { shown, live, livePage, slideLive, liveKind, blank, screenBg, screenText, mediaLive, layout, dset, logo };

  // Plusieurs personnes peuvent piloter le même écran : chaque console reçoit ce que les autres projettent,
  // donc tout le monde voit la même chose à l'écran et ← → repartent du bon endroit.
  // On ne déplace PAS la lecture de l'autre (sa Bible reste où il la consulte).
  useEffect(() => {
    const me = { id: uuid(), name: church.firstName || church.email.split("@")[0], device: window.matchMedia("(min-width: 1024px)").matches ? "ordinateur" : "mobile", role: church.role, uid: church.userId };
    mine.current = me;
    const applyState = (m) => {
      synced.current = true;
      if (chantsOnly && m.shown && m.shown.kind !== allowedKind) { setShown(OTHER); setLive(null); setSlideLive(null); if (m.blank !== undefined) setBlank(m.blank); return; }
      if (m.shown !== undefined) setShown(m.shown);
      setLive(m.r || null);
      setLivePage(m.page ?? 0);
      setSlideLive(m.s || null);
      if (m.liveKind) setLiveKind(m.liveKind);
      if (m.blank !== undefined) setBlank(m.blank);
      if (m.layout) setLayout(m.layout);
      setMediaLive(m.media || null);
    };
    // profils « Chants » et « Annonces » : ils ne voient que leur propre contenu (chants / annonces), le reste s'affiche « écran utilisé »
    const chantsOnly = church.role === "standard" || church.role === "annonces";
    const allowedKind = church.role === "annonces" ? "media" : "chant";
    const hide = (m) => chantsOnly && m.kind !== allowedKind;
    const OTHER = { type: "show", kind: "other", ref: "", text: "", version: "" };
    // état complet envoyé à l'écran (ouverture, reconnexion, confirmation manquante).
    // Une console qui vient de s'ouvrir et ne connaît pas encore l'état ne répond pas : elle effacerait l'écran à tort.
    const sendSnapshot = (extra) => {
      const st = stateRef.current;
      if (!synced.current || st.shown?.kind === "other") return;
      ch.current?.postMessage(buildSnapshot(st, extra));
    };
    let knownScreens = new Set();
    const onRemote = (m) => {
      if (m.type === "helper") { if (m.by?.role === "admin") setHelperIds(m.ids || (m.id ? [m.id] : [])); return; }
      if (m.type === "bg") { setScreenBg(m.bg || null); setScreenText(m.textColor || null); return; }
      if (m.type === "settings") { const c = mergeSettings(m.settings); setDset(c); saveSettings(c); return; }
      if (m.type === "logo") { setLogo(m.logo || null); saveLogo(m.logo || null); return; }
      // l'écran vient de s'ouvrir : on lui renvoie son fond
      if (m.type === "mediaStatus") { setMediaStatus(m.status); return; }
      if (m.type === "speaker?") { const st = stateRef.current; if (st.shown || st.blank) ch.current?.postMessage({ type: "speakerState", shown: st.shown, blank: st.blank }); return; }
      if (m.type === "bg?" || m.type === "display?") {
        const { screenBg: b, screenText: t, layout: l, dset: ds, logo: lg } = stateRef.current;
        if (b || t) ch.current?.postMessage({ type: "bg", bg: b, textColor: t });
        ch.current?.postMessage({ type: "settings", settings: ds });
        if (lg) ch.current?.postMessage({ type: "logo", logo: lg });
        if (l && l !== "full") ch.current?.postMessage({ type: "layout", mode: l });
        if (m.type === "display?") sendSnapshot();      // l'écran vient de s'ouvrir ou de se reconnecter : état complet
        return;
      }
      if (m.type === "layout") { setLayout(m.mode === "band" ? "band" : "full"); return; }
      if (chantsOnly && (m.type === "show" || m.type === "update") && hide(m)) {
        setShown(OTHER); setLive(null); setSlideLive(null);
        return;
      }
      const who = m.by ? { name: m.by.name, device: m.by.device } : null;
      const noted = (what) => { if (who) { setLastBy({ ...who, what }); setRPulse(true); setTimeout(() => setRPulse(false), 700); } };
      if (["show", "update", "clear", "blank"].includes(m.type)) synced.current = true;
      if (m.type === "show" || m.type === "update") {
        setShown({ type: m.type, kind: m.kind, ref: m.ref, text: m.text, version: m.version, bold: m.bold, under: m.under, next: m.next, page: m.page, cols: m.cols, mediaType: m.mediaType, url: m.url, overlay: m.overlay });
        if (m.r) {
          setLive(m.r); setLivePage(m.page?.i ?? 0); setLiveKind("verse");
          if (m.type === "show") setHistory((h) => [m.r, ...h.filter((x) => !(x.b === m.r.b && x.c === m.r.c && x.v === m.r.v && x.vEnd === m.r.vEnd))].slice(0, 15));
        } else if (m.media) { setMediaLive(m.media); setLiveKind("media");
        } else if (m.s) { setSlideLive(m.s); setLiveKind("slide"); }
        else if (m.free) setLiveKind("free");
        if (m.type === "show") noted(m.ref);
      } else if (m.type === "clear") {
        setLive(null); setSlideLive(null); setMediaLive(null); setShown(null);
        noted("a effacé l'écran");
      } else if (m.type === "blank") {
        setBlank(m.on === undefined ? (b) => !b : m.on);
        noted(m.on === false ? "a réaffiché l'écran" : "a mis l'écran en noir");
      } else if (m.type === "sync?") {
        // quelqu'un vient d'ouvrir la console : on lui dit ce qui est à l'écran
        const st = stateRef.current;
        if (st.shown || st.blank) ch.current?.postMessage({ type: "state", to: m.by?.id, shown: st.shown, r: st.live, page: st.livePage, s: st.slideLive, media: st.mediaLive, liveKind: st.liveKind, blank: st.blank, layout: st.layout });
      } else if (m.type === "state" && m.to === me.id) applyState(m);
    };
    ch.current = openScreen(church.token, onRemote, {
      me,
      role: "console",
      onStatus: setNet,
      onConfirm: setScreenOk,
      onResync: () => sendSnapshot({ resync: true }),      // l'écran n'a pas confirmé : on lui renvoie l'état complet
      onScreens: (list) => {
        setScreens(list);
        if (list.some((s) => !knownScreens.has(s.id))) sendSnapshot();   // un écran arrive ou revient : on lui donne l'état complet
        knownScreens = new Set(list.map((s) => s.id));
      },
      onPeers: (list) => setPeers(list.filter((p) => p.id !== me.id).filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)),
      onReady: () => { setTimeout(() => { synced.current = true; }, 1500);   // personne n'a répondu : on est seul, on connaît l'état
        ch.current?.postMessage({ type: "sync?" }); createClient().rpc("get_helpers").then(({ data }) => setHelperIds(data || [])); },
    });
    return () => ch.current.close();
  }, [church.token]);
  // réglages de l'écran PARTAGÉS par toute l'église (table church_settings) : fond, couleur du texte, logo, bandeau / plein écran.
  // Chaque membre les retrouve sur son appareil sans rien reconfigurer ; la copie locale sert seulement à l'affichage instantané.
  // Ils sont renvoyés à l'écran dès qu'il demande (bg? / display?).
  useEffect(() => { setDset(loadSettings()); setLogo(loadLogo()); }, []);
  useEffect(() => {
    if (!church?.id) return;
    let off = false;
    const apply = async () => {
      let { data } = await fetchChurchSettings(church.id);
      if (off) return;
      if (!data && church.role === "admin") { const legacy = await migrateLegacy(church.id); if (legacy) data = legacy; }   // reprise unique de l'ancien stockage du navigateur
      if (!data) return;                                  // rien d'enregistré pour l'église : valeurs locales / par défaut
      const a = appliedOf(data.bgs), ds = mergeSettings(data.display);
      setDset(ds); setLogo(data.logo || null); setScreenBg(a.bg); setScreenText(a.text || null);
      cacheLocally({ display: ds, logo: data.logo });
    };
    apply();
    const stop = watchChurchSettings(church.id, apply);   // un administrateur change les réglages depuis un autre appareil
    return () => { off = true; stop(); };
  }, [church?.id, church?.role]);
  const screenUrl = () => `${location.origin}/display?k=${church.token}`;
  const copyObs = () => navigator.clipboard?.writeText(`${screenUrl()}&transparent=1`).then(() => { setCopiedObs(true); setTimeout(() => setCopiedObs(false), 1500); });
  const copyScreen = () => navigator.clipboard?.writeText(screenUrl()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  // jeton d'écran compromis ou lien partagé trop largement : on en génère un nouveau (les anciens liens cessent de marcher)
  const rotateToken = async () => {
    if (!confirm("Régénérer le lien de l'écran ?\n\nLes écrans et vues orateur déjà ouverts seront déconnectés : il faudra les rouvrir avec le nouveau lien.")) return;
    const { error } = await createClient().rpc("rotate_screen_token");
    if (error) return alert("Impossible de régénérer le lien : " + error.message);
    location.reload();
  };
  const logout = async () => { await createClient().auth.signOut(); location.href = "/login"; };

  // /control?tab=notes, chants ou annonces (liens de la page d'accueil)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if ((t === "notes" || t === "chants" || t === "annonces" || t === "plan") && tabs.includes(t)) setTab(t);
  }, []);

  // liste des versions réellement générées au build
  // + les versions en ligne (Semeur, Segond 21…) si la clé YouVersion est configurée sur le serveur
  useEffect(() => {
    Promise.all([
      fetch("/bible/versions.json").then((r) => r.json()).catch(() => []),
      fetch("/api/bible?action=versions").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([local, remote]) => {
      const list = [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])];
      if (!list.length) return;
      setVersions(list);
      setVersion((cur) => (list.some((v) => v.id === cur) ? cur : list[0].id));
    });
  }, []);

  // versions en ligne : on télécharge les chapitres dont on a besoin (référence tapée, chapitre affiché)
  useEffect(() => {
    if (!bible || !q.trim()) return;
    const ref = parseRef(q);
    if (!ref || !ref.chapter) return;
    ref.books.slice(0, 3).forEach((b) => { if (bible[b]?.[ref.chapter - 1]) ensureChapter(b, ref.chapter - 1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, loaded]);
  useEffect(() => {
    if (view && bible?.[view.b]?.[view.c]) ensureChapter(view.b, view.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loaded]);
  // le chapitre demandé vient d'arriver : on termine la projection / la re-projection en attente
  useEffect(() => {
    const p = pendingProject.current;
    if (p && chapterReady(p.r.b, p.r.c)) { pendingProject.current = null; project(p.r, p.citeRange, p.page); }
    const r = pendingReproject.current;
    if (r && chapterReady(r.b, r.c)) { pendingReproject.current = null; reproject(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bible]);


  const label = versions.find((v) => v.id === loaded)?.label ?? (loaded || version).toUpperCase();
  const label2 = versions.find((v) => v.id === loaded2)?.label ?? (loaded2 || version2 || "").toUpperCase();
  // 2e version : à l'ouverture on prend la première version différente de la principale
  const toggleCompare = () => {
    if (compare) { setCompare(false); setLiveBoth(false); return; }
    if (!version2 || version2 === version) setVersion2((versions.find((v) => v.id !== version) || versions[0])?.id || "");
    setCompare(true);
  };
  useEffect(() => {
    if (compare && view && bible2?.[view.b]?.[view.c]) ensureChapter2(view.b, view.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loaded2, compare]);

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

  const textOf = (r, bb = bible) => {
    const vs = bb?.[r.b]?.[r.c];
    if (!vs) return "";
    const end = Math.min(r.vEnd ?? r.v, vs.length - 1);
    return vs.slice(r.v, end + 1).map((t, i) => (end > r.v ? `${r.v + i + 1} ` : "") + (t ?? "")).join(" ");
  };
  const refOf = (r) => `${BOOKS[r.b]} ${r.c + 1}:${r.v + 1}${r.vEnd && r.vEnd > r.v ? "-" + (r.vEnd + 1) : ""}`;

  // verset suivant : envoyé à la vue orateur (« à venir »)
  const nextVerse = (r, bb = bible) => {
    const vs = bb?.[r.b]?.[r.c];
    const nv = (r.vEnd ?? r.v) + 1;
    if (!vs || vs[nv] === undefined) return null;
    const n = { b: r.b, c: r.c, v: nv, vEnd: null };
    return { ref: refOf(n), text: textOf(n, bb) };
  };

  const flash = () => { synced.current = true; setLastBy(null); setPulse(true); setTimeout(() => setPulse(false), 250); };

  // pages d'un passage (un passage long est découpé : voir lib/paginate.js). La longueur d'une page se règle dans l'Administration.
  const pagesOf = (r, bb = bible) => {
    const vs = bb?.[r.b]?.[r.c];
    if (!vs) return [textOf(r, bb)];
    return pagesOfRange(vs, r.v, r.vEnd, layout === "band" ? dset.band.pageChars : dset.full.pageChars);
  };
  // message « verset / passage » pour la page demandée (clampée) : texte de la page, repère « 2/5 », et « à venir » pour la vue orateur
  const verseMsg = (type, r, page) => {
    const pages = pagesOf(r);
    const i = Math.min(Math.max(page, 0), pages.length - 1);
    const next = i < pages.length - 1 ? { ref: `${refOf(r)} · suite`, text: pages[i + 1] } : nextVerse(r);
    return { msg: { type, ref: refOf(r), text: pages[i], version: label, r, page: pages.length > 1 ? { i, n: pages.length } : null, next }, i };
  };

  const project = (r, citeRange, page = 0) => {
    if (!canProject) return;
    if (!chapterReady(r.b, r.c)) { pendingProject.current = { r, citeRange, page }; ensureChapter(r.b, r.c); return; }
    setView({ b: r.b, c: r.c });
    setCite((prev) => (citeRange !== undefined ? citeRange : prev && prev.b === r.b && prev.c === r.c ? prev : null));
    const { msg, i } = verseMsg("show", r, page);
    setLiveBoth(false);
    setLive(r);
    setLivePage(i);
    setLiveKind("verse");
    setShown(msg);
    setNav({ b: r.b, c: r.c });
    setHistory((h) => [r, ...h.filter((x) => refOf(x) !== refOf(r))].slice(0, 15));
    ch.current?.postMessage(msg);
    flash();
  };

  // comparaison : le même passage dans 2 versions, affichés ensemble à l'écran
  const bothTarget = q.trim() && results[sel] ? results[sel] : liveKind === "verse" && live ? live : null;
  const bothReady = !!(compare && bothTarget && bible?.[bothTarget.b]?.[bothTarget.c] && bible2?.[bothTarget.b]?.[bothTarget.c]?.[bothTarget.v] && chapterReady(bothTarget.b, bothTarget.c) && chapterReady2(bothTarget.b, bothTarget.c));
  const projectBoth = (r) => {
    if (!canProject || !compare || !bible2) return;
    if (!chapterReady(r.b, r.c) || !chapterReady2(r.b, r.c)) return;
    const t1 = textOf(r), t2 = textOf(r, bible2);
    if (!t1 || !t2) return setHint("Ce verset n'existe pas dans l'une des deux versions.");
    const rr = { b: r.b, c: r.c, v: r.v, vEnd: r.vEnd ?? null };
    const msg = { type: "show", ref: refOf(rr), text: `${label}\n${t1}\n\n${label2}\n${t2}`, version: `${label} · ${label2}`, cols: [{ label, text: t1 }, { label: label2, text: t2 }], r: rr, page: null, next: nextVerse(rr) };
    setView({ b: rr.b, c: rr.c });
    setNav({ b: rr.b, c: rr.c });
    setLive(rr); setLivePage(0); setLiveKind("verse"); setLiveBoth(true);
    setShown(msg);
    setHistory((h) => [rr, ...h.filter((x) => refOf(x) !== refOf(rr))].slice(0, 15));
    ch.current?.postMessage(msg);
    flash();
  };

  // diapositive d'une note ou d'un chant
  const projectSlide = (kind, item, i, slides) => {
    if (!canProject) return;
    const msg = { type: "show", kind: kind === "chants" ? "chant" : "slide", ref: `${item.title} · ${i + 1}/${slides.length}`, text: slides[i], version: "", s: { kind, id: item.id, i }, next: slides[i + 1] ? { ref: "", text: slides[i + 1] } : null };
    setSlideLive({ kind, id: item.id, i });
    setLiveKind("slide");
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };

  // phrase clé d'une note : projetée comme une diapositive, mais gardée dans la note pour y revenir
  const projectKey = (item, k, text) => {
    if (!canProject) return;
    const t = text ?? item.keys?.[k];
    if (t === undefined) return;
    const msg = { type: "show", kind: "slide", ref: "", text: t, version: "", s: { kind: "notes", id: item.id, key: k }, next: null };
    setSlideLive({ kind: "notes", id: item.id, key: k });
    setLiveKind("slide");
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  // garde une phrase dans la note ouverte (et la projette tout de suite si demandé)
  const keepKey = (text, andProject) => {
    const note = library.lib.notes.find((x) => x.id === noteId);
    if (!note) return;
    const keys = [...(note.keys || []), text];
    library.update("notes", note.id, { keys });
    if (andProject) projectKey(note, keys.length - 1, text);
  };

  // texte rapide (disponible dans tous les onglets) : projeté tel quel, on reste dessus
  const projectFree = (text) => {
    if (!canProject) return;
    const chant = tab === "chants" ? library.lib.chants.find((x) => x.id === chantId) : null;
    const msg = { type: "show", kind: "chant", ref: chant ? `${chant.title} · texte libre` : "Texte rapide", text, version: "", free: true };
    setLiveKind("free");
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  // annonce (photo / vidéo) : projetée plein écran
  const projectMedia = (a) => {
    if (!canProject) return;
    const msg = { type: "show", kind: "media", mediaType: a.kind, url: a.url, ref: a.name, text: "", version: "", media: { id: a.id } };
    setMediaLive({ id: a.id });
    setMediaStatus(null);
    setLiveKind("media");
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  // verset par-dessus l'image à l'écran (l'image et la vidéo ne sont pas relancées)
  const projectOverlay = (r) => {
    if (!canProject || !shown || shown.kind !== "media") return;
    const msg = { ...shown, type: "update", media: mediaLive, overlay: { ref: refOf(r), text: textOf(r), version: label } };
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  const clearOverlay = () => {
    if (!canProject || !shown || shown.kind !== "media") return;
    const { overlay, ...rest } = shown;
    const msg = { ...rest, type: "update", media: mediaLive };
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  // image trouvée sur internet : on envoie seulement le lien, l'écran la charge directement (rien n'est enregistré)
  const projectWebImage = (url, name) => projectMedia({ id: "web:" + url, kind: "image", url, name });
  const webImageEl = church.role !== "standard" && (
    <div className={showWeb ? "" : "hidden"}>
      <WebImage
        onProject={projectWebImage}
        disabled={!canProject}
        liveUrl={liveKind === "media" && typeof mediaLive?.id === "string" && mediaLive.id.startsWith("web:") ? mediaLive.id.slice(4) : null}
        status={mediaStatus}
      />
    </div>
  );
  const mediaCmd = (cmd) => { if (canProject) ch.current?.postMessage({ type: "media", cmd }); };
  const clearScreen = () => {
    if (!canProject) return;
    setQ("");
    ch.current?.postMessage({ type: "clear" });
    setLastBy(null);
    setLive(null);
    setLivePage(0);
    setSlideLive(null);
    setMediaLive(null);
    setShown(null);
  };
  // « noir » est explicite (on / off) : si deux personnes appuient, l'écran ne bascule pas dans le mauvais sens
  // ids = les personnes autorisées (une Aide écran et un Orateur au maximum), [] pour tout arrêter
  const pickHelpers = async (ids) => {
    setHelpBusy(true);
    const { error } = await createClient().rpc("set_helpers", { ids });
    setHelpBusy(false);
    if (error) return alert("Impossible de changer l'aide : " + error.message);
    setHelperIds(ids);
    ch.current?.postMessage({ type: "helper", ids });
  };
  const toggleBlank = () => { if (!canProject) return; const on = !blank; ch.current?.postMessage({ type: "blank", on }); setBlank(on); setLastBy(null); };

  // changement de version : le verset à l'écran est re-projeté dans la nouvelle version
  const reproject = (r) => {
    if (!canProject) return;
    if (!chapterReady(r.b, r.c)) { pendingReproject.current = r; ensureChapter(r.b, r.c); return; }
    if (!bible?.[r.b]?.[r.c]?.[r.v]) return;           // verset absent de cette version : l'écran reste tel quel
    const { msg, i } = verseMsg("update", r, livePage);     // même page qu'avant (ou la dernière si la nouvelle version est plus courte)
    setLivePage(i);
    setShown(msg);
    ch.current?.postMessage(msg);
    flash();
  };
  useEffect(() => {
    if (!bible || !loaded) return;
    if (prevLoaded.current && prevLoaded.current !== loaded && live && liveKind === "verse") (liveBoth ? projectBoth(live) : reproject(live));
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
  const canStep = canProject && (liveKind === "media" ? !!mediaLive : onSlides ? !!slideLive : !!live);
  const step = (d) => {
    if (liveKind === "media") {
      const i = ann.list.findIndex((x) => x.id === mediaLive?.id);
      const t = ann.list[i + d];
      if (i >= 0 && t) projectMedia(t);
      return;
    }
    if (onSlides) {
      if (!slideLive) return;
      const item = library.lib[slideLive.kind].find((x) => x.id === slideLive.id);
      if (!item) return;
      if (slideLive.key !== undefined) {                 // phrases clés : ← → passent à la phrase gardée d'avant / d'après
        const k = slideLive.key + d;
        if (item.keys?.[k] !== undefined) projectKey(item, k);
        return;
      }
      const slides = slidesOf(item);
      const i = slideLive.i + d;
      if (i >= 0 && i < slides.length) projectSlide(slideLive.kind, item, i, slides);
      return;
    }
    if (!live || !bible) return;
    if (liveBoth && compare) {                           // 2 versions à l'écran : ← → passent au verset d'avant / d'après dans les deux
      const vs = bible[live.b]?.[live.c];
      const v = d > 0 ? (live.vEnd ?? live.v) + 1 : live.v - 1;
      if (vs && v >= 0 && v < vs.length) projectBoth({ b: live.b, c: live.c, v, vEnd: null });
      return;
    }
    // passage long : ← → tournent d'abord les pages, puis passent au verset d'avant / d'après
    const pages = pagesOf(live);
    const pi = livePage + d;
    if (pi >= 0 && pi < pages.length) { project(live, undefined, pi); return; }
    const vs = bible[live.b]?.[live.c];
    if (!vs) return;
    const v = d > 0 ? (live.vEnd ?? live.v) + 1 : live.v - 1;
    if (v >= 0 && v < vs.length) project({ b: live.b, c: live.c, v, vEnd: null }, undefined, d < 0 ? Infinity : 0);   // en reculant : dernière page du verset précédent
  };

  // la sélection faite dans l'aperçu est mémorisée : toucher le bouton « B » ne la perd pas (téléphone)
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      const el = previewTxt.current;
      if (!sel || !sel.rangeCount || sel.isCollapsed) return;       // sélection vide : on garde la précédente
      const rg = sel.getRangeAt(0);
      if (!el || !el.contains(rg.commonAncestorContainer)) { selRef.current = null; return; }
      const pre = rg.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(rg.startContainer, rg.startOffset);
      const start = pre.toString().length;
      selRef.current = { start, end: start + rg.toString().length };
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);
  useEffect(() => { selRef.current = null; }, [shown?.ref, shown?.text]);
  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(null), 3500); return () => clearTimeout(t); }, [hint]);

  // gras (B, Ctrl+B) ou souligné (U, Ctrl+U) sur la partie du verset sélectionnée dans l'aperçu
  const applyFormat = (field) => {
    if (!canProject) return;
    if (!shown || shown.kind === "other" || shown.kind === "media") return setHint("Projette d'abord un verset ou un texte.");
    if (shown.kind === "chant") return setHint("Le gras et le souligné ne s'appliquent pas aux chants.");
    const sel = selRef.current;
    if (!sel) return setHint("Sélectionne des mots dans l'aperçu de l'écran, puis appuie sur B (gras) ou U (souligné).");
    let { start, end } = sel;
    const tx = shown.text || "";
    while (start < end && /\s/.test(tx[start])) start++;
    while (end > start && /\s/.test(tx[end - 1])) end--;
    if (end <= start) return setHint("Sélectionne des mots dans l'aperçu de l'écran, puis appuie sur B (gras) ou U (souligné).");
    const msg = { ...shown, type: "update", [field]: toggleRange(shown[field] || [], start, end) };
    ch.current?.postMessage(msg);
    setShown(msg);
    setLastBy(null);
    selRef.current = null;
    document.getSelection()?.removeAllRanges();
  };
  const applyBold = () => applyFormat("bold");
  const applyUnder = () => applyFormat("under");

  // plein écran ↔ bandeau : change tout de suite, même avec un verset à l'écran
  const setLayoutMode = (mode) => {
    if (!canProject || isOrateur || mode === layout) return;
    setLayout(mode);
    ch.current?.postMessage({ type: "layout", mode });
    setLastBy(null);
  };

  // ───── plan de culte (Supabase, partagé entre appareils) ─────
  const planOn = ["admin", "assistant", "orateur"].includes(church.role);      // « Chants » et « Annonces » n'y ont pas accès
  const planReadOnly = !["admin", "assistant"].includes(church.role);          // écriture réservée à l'admin et à l'aide écran (comme les règles SQL)
  const plan = useServicePlans(planOn);
  const planMissing = (it) => (it.k === "chants" || it.k === "notes") ? !library.lib[it.k].some((x) => x.id === it.itemId)
    : it.k === "media" ? ann.ready && !ann.list.some((x) => x.id === it.itemId) : false;
  const playPlanItem = (it) => {
    if (!canProject) return;
    setPlanActive(it.id);
    if (it.k === "verse" && it.r) project(it.r);
    else if (it.k === "chants" || it.k === "notes") {
      const item = library.lib[it.k].find((x) => x.id === it.itemId);
      if (!item) return setHint("Cet élément n'existe plus dans la bibliothèque.");
      if (it.k === "chants") setChantId(item.id); else setNoteId(item.id);
      projectSlide(it.k, item, 0, slidesOf(item));
    }
    else if (it.k === "media") {
      const a = ann.list.find((x) => x.id === it.itemId);
      if (!a) return setHint("Cette annonce n'existe plus (ou a expiré).");
      projectMedia(a);
    }
    else if (it.k === "text") projectFree(it.text || it.title);
  };
  const planStep = (d) => {
    const i = plan.items.findIndex((x) => x.id === planActive);
    const t = plan.items[i < 0 ? (d > 0 ? 0 : -1) : i + d];
    if (t) playPlanItem(t);
  };
  const planAddRef = (str) => {
    const ref = parseRef(str);
    if (!ref) return false;
    const b = ref.books[0], c = ref.chapter ? ref.chapter - 1 : 0, v = ref.verse ? ref.verse - 1 : 0;
    if (bible && !bible[b]?.[c]) return false;
    const r = { b, c, v, vEnd: ref.verseEnd && ref.verseEnd - 1 > v ? ref.verseEnd - 1 : null };
    return plan.add({ k: "verse", title: refOf(r), r });
  };
  const planAddLib = (kind, id) => {
    if (kind === "media") { const a = ann.list.find((x) => x.id === id); if (a) plan.add({ k: "media", title: a.name, itemId: a.id }); return; }
    const item = library.lib[kind]?.find((x) => x.id === id);
    if (item) plan.add({ k: kind, title: item.title, itemId: item.id });
  };
  const planAddCurrent = () => {
    if (liveKind === "verse" && live) return plan.add({ k: "verse", title: refOf(live), r: { b: live.b, c: live.c, v: live.v, vEnd: live.vEnd ?? null } });
    if (liveKind === "slide" && slideLive) { const item = library.lib[slideLive.kind]?.find((x) => x.id === slideLive.id); if (item) plan.add({ k: slideLive.kind, title: item.title, itemId: item.id }); return; }
    if (liveKind === "media" && mediaLive && !String(mediaLive.id).startsWith("web:")) { const a = ann.list.find((x) => x.id === mediaLive.id); if (a) plan.add({ k: "media", title: a.name, itemId: a.id }); return; }
    if (liveKind === "free" && shown?.text) plan.add({ k: "text", title: shown.text.split("\n")[0].slice(0, 60), text: shown.text });
  };

  // Voice (test) : valide la référence entendue dans la Bible chargée, puis ouvre le chapitre ou projette le verset
  const voiceResolve = ({ b, chapter, verse, vEnd }) => {
    const chap = bible?.[b]?.[chapter - 1];
    if (!chap) return null;
    if (verse != null && Array.isArray(chap) && !chap[verse - 1]) return null;
    const r = { b, c: chapter - 1, v: verse != null ? verse - 1 : null, vEnd: vEnd && vEnd > verse && (!Array.isArray(chap) || chap[vEnd - 1]) ? vEnd - 1 : null };
    return { ...r, label: r.v == null ? `${BOOKS[b]} ${chapter}` : refOf(r) };
  };
  // Voice (test) : versets dont le texte ressemble à ce qui vient d'être dit (sans référence) ; versions locales seulement (index de recherche)
  const voiceSimilar = (text, level) => findSimilarVerses(text, index, bible, level).map((m) => ({ b: m.b, c: m.c, v: m.v, label: refOf({ b: m.b, c: m.c, v: m.v }), snippet: m.text }));
  const voicePick = (r) => {
    if (r.v == null) { ensureChapter(r.b, r.c); setView({ b: r.b, c: r.c }); setNav({ b: r.b, c: r.c }); if (tabs.includes("bible")) { setTab("bible"); setShowWeb(false); } return; }
    project({ b: r.b, c: r.c, v: r.v, vEnd: r.vEnd });
  };

  const onKey = (e) => {
    const t = e.target;
    // on tape dans le formulaire d'une note : les raccourcis ne s'appliquent pas
    if (t.tagName === "TEXTAREA" || t.isContentEditable || (t.tagName === "INPUT" && t !== searchRef.current)) {
      if (e.key === "Escape") t.blur();
      return;
    }
    // le clavier agit sur une liste déroulante ou un bouton : on le laisse faire (Entrée / Espace / flèches)
    if (t.tagName === "SELECT") return;
    if ((t.tagName === "BUTTON" || t.tagName === "A") && (e.key === "Enter" || e.key === " ")) return;
    // autres combinaisons (Ctrl+flèche, Alt+…) : ce ne sont pas nos raccourcis, sauf Ctrl+E (écran noir), Ctrl+B (gras) et Ctrl+U (souligné)
    if ((e.ctrlKey || e.metaKey || e.altKey) && !((e.ctrlKey || e.metaKey) && ["b", "e", "u"].includes(e.key.toLowerCase()))) return;
    const inField = t === searchRef.current;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "e") { e.preventDefault(); toggleBlank(); }
    else if ((e.ctrlKey || e.metaKey) && k === "b") { e.preventDefault(); applyBold(); }
    else if ((e.ctrlKey || e.metaKey) && k === "u") { e.preventDefault(); applyUnder(); }
    else if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { project(results[sel]); setQ(""); }
    else if (e.key === "Escape") clearScreen();
    else if (!q && planOn && e.key === "PageDown") { e.preventDefault(); planStep(1); }
    else if (!q && planOn && e.key === "PageUp") { e.preventDefault(); planStep(-1); }
    else if (!q && e.key === "ArrowRight") step(1);
    else if (!q && e.key === "ArrowLeft") step(-1);
    else if (!q && !inField && k === "n") toggleBlank();
    else if (!q && !inField && k === "b" && !isOrateur) setLayoutMode(layout === "band" ? "full" : "band");
  };

  // les raccourcis écoutent toute la page (et plus seulement la zone où se trouve le curseur)
  const keyRef = useRef(null);
  keyRef.current = onKey;
  useEffect(() => {
    const h = (e) => keyRef.current?.(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const btn = "rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";
  const PB = dset.band, PF = dset.full;                  // l'aperçu suit les mêmes réglages que l'écran
  const bandPreview = layout === "band" && shown && shown.kind !== "media";
  const size = shown ? (shown.text.length < 110 ? "text-sm sm:text-base" : shown.text.length < 220 ? "text-xs sm:text-sm" : "text-xs sm:text-xs") : "";
  const chapters = nav.b !== null ? bible?.[nav.b] : null;

  // voyant de l'écran : la console dit clairement si ce qu'elle envoie arrive
  const scr = screenOk === false ? { c: "bg-red-500", t: tr("scr.noConfirm"), tip: tr("scr.noConfirmTip") }
    : screenOk || screens.length ? { c: "bg-green-400", t: tr("scr.ok"), tip: tr("scr.okTip") }
    : net === "offline" ? { c: "bg-amber-400", t: tr("scr.offline"), tip: tr("scr.offlineTip") }
    : { c: "bg-neutral-500", t: tr("scr.none"), tip: tr("scr.noneTip") };

  return (
    <main className={`min-h-screen bg-neutral-900 text-white p-3 sm:p-6 2xl:px-10 ${typing ? "pb-[55vh] lg:pb-6" : ""}`}>
      {/* barre du haut */}
      <header className="mb-5 sm:mb-8 space-y-3">
        <a href="/" title={tr("common.home")} className="inline-flex items-center gap-2.5 transition duration-100 active:scale-95">
          <img src="/logo-96.png" alt="" width={40} height={40} className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="text-xl sm:text-2xl font-semibold leading-none">Hosanna <span className="text-amber-400">Cast</span></span>
        </a>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
    {(tabs.length > 1 || church.role !== "standard") && (
    <div className="w-full lg:w-auto flex flex-wrap gap-1 bg-neutral-800 rounded-lg p-1">
      {["bible", "notes", "chants", "annonces", "plan"].filter((k) => tabs.includes(k)).map((k) => (
        <button key={k} onClick={() => { setTab(k); setShowWeb(false); }}
          className={`flex-1 lg:flex-none min-w-fit px-3 py-1.5 rounded-md text-sm transition duration-100 active:scale-95 ${tab === k && !showWeb ? "bg-neutral-600 text-white font-medium" : "text-neutral-400 hover:text-white"}`}>{tr(`tab.${k}`)}</button>
      ))}
      {church.role !== "standard" && (
        <button onClick={() => setShowWeb((v) => !v)} title={tr("tab.webTitle")} aria-label={tr("tab.webTitle")} aria-pressed={showWeb}
          className={`flex-1 lg:flex-none min-w-fit px-3 py-1.5 rounded-md text-sm transition duration-100 active:scale-95 ${showWeb ? "bg-sky-400 text-black font-medium" : "text-sky-300 hover:text-white"}`}>🌐 {tr("tab.web")}</button>
      )}
    </div>
    )}

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          {church.role === "admin" && <HelpControl helperIds={helperIds} peers={peers} busy={helpBusy} onChange={pickHelpers} />}
          <span className="flex items-center gap-1.5 rounded-full bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300" title={scr.tip} role="status">
            <span className={`h-2 w-2 rounded-full ${scr.c}`} />
            <span className={screenOk === false ? "" : "hidden sm:inline"}>{scr.t}</span>
          </span>
          {peers.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-neutral-800 border border-neutral-700 pl-2 pr-1 py-1" title={peers.map((p) => `${p.name} (${p.device})`).join(", ") + " : " + tr("scr.alsoConnected")}>
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="hidden sm:inline text-xs text-neutral-300">{peers.length === 1 ? peers[0].name : tr("scr.others", { n: peers.length })}</span>
              {peers.slice(0, 3).map((p) => (
                <span key={p.id} className="h-6 w-6 rounded-full bg-sky-500/80 text-[11px] font-medium text-black flex items-center justify-center">{(p.name || "?").charAt(0).toUpperCase()}</span>
              ))}
            </div>
          )}
          <UserMenu church={church} onRotate={church.role === "admin" ? rotateToken : null} copied={copied} onCopy={copyScreen} copiedObs={copiedObs} onCopyObs={copyObs} onLogout={logout} />
        </div>
        </div>
      </header>

      <div className={`grid gap-3 lg:gap-5 items-start ${leftHidden && !showWeb ? "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_480px]" : "lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_380px] 2xl:grid-cols-[380px_minmax(0,1fr)_480px]"}`}>

        {/* ───── gauche : Bible, notes, chants ───── */}
        <section className={`order-3 lg:order-1 lg:sticky lg:top-6 ${showWeb ? "lg:col-span-2" : ""} ${leftHidden && !showWeb ? "lg:hidden" : ""}`}>
          {webImageEl}

          {tabs.includes("bible") && tab !== "annonces" && tab !== "plan" && tab !== "chants" && !showWeb && (() => {
            // une version qui n'est pas dans l'application s'ouvre sur bible.com : chapitre visé, verset en surbrillance
            const t = q.trim() ? results[sel] : liveKind === "verse" && live ? live : view ? { b: view.b, c: view.c, v: null } : null;
            const passage = t ? `${USFM[t.b]}.${t.c + 1}${t.v != null ? `.${t.v + 1}${t.vEnd != null && t.vEnd > t.v ? `-${t.vEnd + 1}` : ""}` : ""}` : null;
            return (
              <div className="mb-1.5 sm:mb-2">
                <VersionSelect versions={versions} value={version} onChange={setVersion} loading={loading} webVersions={WEB_VERSIONS}
                  onWeb={(v) => {
                    if (!v) return;
                    if (!passage) return setHint("Tape ou choisis d'abord un verset pour l'ouvrir sur bible.com.");
                    window.open(`https://www.bible.com/bible/${v.web}/${passage}.${v.label}`, "_blank", "noopener,noreferrer");
                  }} />
              </div>
            );
          })()}
          {tabs.includes("bible") && tab !== "annonces" && tab !== "plan" && tab !== "chants" && !showWeb && online && (
            <p className="text-[10px] leading-snug text-neutral-500 mb-1.5">
              {bibleError ? <span className="text-red-400">Version en ligne indisponible : {bibleError}</span> : versions.find((v) => v.id === version)?.copyright}
            </p>
          )}

          <div ref={panel} className={`${showWeb ? "hidden " : ""}relative bg-neutral-800/60 border border-neutral-700 rounded-xl p-2 sm:p-3 max-h-[55vh] lg:max-h-[calc(100vh-7.5rem)] overflow-y-auto`}>
            {tab === "plan" ? (
              <PlanAdd
                plan={plan}
                readOnly={planReadOnly}
                lib={{ chants: library.lib.chants, notes: library.lib.notes, media: ann.list }}
                onAddRef={planAddRef}
                onAddLib={planAddLib}
                onAddCurrent={planAddCurrent}
                canAddCurrent={!!shown && shown.kind !== "other" && !(liveKind === "media" && String(mediaLive?.id).startsWith("web:"))}
              />
            ) : tab === "annonces" ? (
              <div className="space-y-3">
                <AnnoncesAdd ann={ann} ui={annUi} />
                <AnnoncesSections ann={ann} ui={annUi} />
              </div>
            ) : tab !== "bible" ? (
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
                playlists={playlists}
                bible={bible}
                refOf={refOf}
                textOf={textOf}
                pausedSlide={liveKind !== "slide" ? slideLive : null}
                isLiveVerse={isLiveVerse}
                liveSlide={liveKind === "slide" ? slideLive : null}
                onSlide={(item, i, slides) => projectSlide(tab, item, i, slides)}
                onVerse={projectFirst}
                onKeyPhrase={projectKey}
                onOpen={setNoteId}
                stage={tab === "notes" && wide ? stageEl : null}
                plOpenId={plId}
                onPlOpenId={setPlId}
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

                {!wide && nav.b !== null && nav.c !== null && chapters?.[nav.c] && chapterReady(nav.b, nav.c) && (
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

        {/* ───── centre : texte rapide (toujours en haut) puis contenu de l'onglet ───── */}
        <div className={`order-2 min-w-0 space-y-3 ${showWeb ? "hidden" : ""}`}>
          {tabs.includes("bible") && tab !== "chants" && tab !== "annonces" && <VoiceRefs resolve={voiceResolve} similar={voiceSimilar} onPick={voicePick} canProject={canProject} />}
          {church.role !== "annonces" && !isOrateur && tab !== "chants" && tab !== "annonces" && (
          <QuickText
            onProject={projectFree}
            disabled={!canProject}
            {...(tab === "notes" && noteId && library.lib.notes.some((x) => x.id === noteId)
              ? { onAdd: (t) => keepKey(t, false), addLabel: "Garder dans la note", onAddProject: (t) => keepKey(t, true), addProjectLabel: "Projeter et garder" }
              : {})}
          />
          )}
        <div className="space-y-3">
        {tab === "plan" ? (
        <section className="min-w-0">
          <PlanList
            plan={plan}
            activeItemId={planActive}
            canProject={canProject}
            readOnly={planReadOnly}
            missing={planMissing}
            onPlay={playPlanItem}
            onNext={() => planStep(1)}
            onPrev={() => planStep(-1)}
          />
        </section>
        ) : tab === "annonces" ? (
        <section className="min-w-0 space-y-3">
          <AnnonceStage
            item={ann.list.find((x) => x.id === mediaLive?.id) || null}
            live={liveKind === "media" && !!shown && shown.kind === "media"}
            blank={blank}
            canProject={canProject}
            onCmd={mediaCmd}
            status={mediaStatus}
          />
          <AnnoncesGrid ann={ann} ui={annUi} liveId={liveKind === "media" ? mediaLive?.id : null} canProject={canProject} onProject={projectMedia} />
        </section>
        ) : tab === "chants" ? (
        <section className="min-w-0">
          <ChantBar
            item={library.lib.chants.find((x) => x.id === chantId) || null}
            count={(() => { const c = library.lib.chants.find((x) => x.id === chantId); return c ? slidesOf(c).length : 0; })()}
            liveIndex={liveKind === "slide" && slideLive?.kind === "chants" && slideLive.id === chantId ? slideLive.i : null}
            playlist={playlists.list.find((p) => p.id === plId) || null}
            chants={library.lib.chants}
            selectedId={chantId}
            onPick={setChantId}
            onStep={step}
            canStep={canStep && liveKind === "slide" && slideLive?.kind === "chants"}
          />
          <ChantStage
            item={library.lib.chants.find((x) => x.id === chantId) || null}
            bible={bible}
            refOf={refOf}
            textOf={textOf}
            isLiveVerse={isLiveVerse}
            liveSlide={liveKind === "slide" && slideLive?.kind === "chants" ? slideLive : null}
            pausedSlide={liveKind !== "slide" && slideLive?.kind === "chants" ? slideLive : null}
            onSlide={(item, i, slides) => projectSlide("chants", item, i, slides)}
            onVerse={projectFirst}
            onUpdate={(id, patch) => library.update("chants", id, patch)}
            onRemove={(id) => { library.remove("chants", id); setChantId(null); }}
          />
        </section>
        ) : (
        <section className="min-w-0">
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

          <div className={tab === "notes" && wide ? "grid gap-3 xl:grid-cols-2 items-start mt-3" : ""}>
          {tab === "notes" && wide && <div ref={setStageEl} className="min-w-0 empty:hidden" />}
          <div className="min-w-0">
          <ul className="mt-2 lg:mt-3 space-y-1 max-h-[36vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
            {results.map((r, i) => (
              <li key={i} onClick={() => { project(r); setQ(""); searchRef.current?.blur(); }}
                className={`p-2.5 sm:p-3 rounded-lg cursor-pointer select-none transition duration-100 active:scale-[0.98] active:brightness-125 ${i === sel ? "bg-amber-400 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
                <b className="font-medium">{refOf(r)}</b>{" "}
                <span className={i === sel ? "text-black/70" : "text-neutral-400"}>{textOf(r).slice(0, 140)}</span>
              </li>
            ))}
          </ul>

          {!q.trim() && bible && (view && bible[view.b]?.[view.c] && chapterReady(view.b, view.c) ? (
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
          ) : view && !chapterReady(view.b, view.c) ? (
            <p className="mt-4 text-sm text-neutral-500">Chargement du chapitre…</p>
          ) : (
            <p className="hidden lg:block mt-4 text-sm text-neutral-500 leading-6">
              Tape une référence (<span className="text-neutral-300">jn 3 16</span>, <span className="text-neutral-300">1 co 13</span>) ou quelques mots du verset.
              Le prédicateur cite un autre verset ? Cherche-le ici, ta note reste ouverte.
            </p>
          ))}
          {q.trim() && bible && !results.length && (
            <p className="mt-3 text-sm text-neutral-500">{online ? "Cette version en ligne se cherche par référence (jn 3 16), pas par mots." : index ? "Aucun résultat. Essaie d'autres mots." : "Préparation de la recherche…"}</p>
          )}
          </div>
          </div>
        </section>
        )}
        </div>
        </div>

        {/* ───── droite : l'écran (en premier sur mobile) ───── */}
        <aside className="order-1 lg:order-3 lg:sticky lg:top-6">
          <div className={`relative h-28 sm:h-auto sm:aspect-video sm:w-3/4 sm:mx-auto rounded-xl bg-black border transition-all duration-300 ${pulse ? "border-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.35)]" : rPulse ? "border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.4)]" : "border-neutral-700"}`} style={{ ...bgStyle(blank ? null : screenBg), color: screenText || undefined, containerType: "size" }}>
            {logo && !blank && !(shown && shown.kind === "media") && (
              <img src={logo} alt="" draggable={false} className="absolute w-auto h-auto object-contain pointer-events-none select-none"
                   style={{ top: "2cqh", [dset.top.side === "left" ? "left" : "right"]: "2cqw", maxWidth: `${13 * dset.top.size / 100}cqw`, maxHeight: `${23 * dset.top.size / 100}cqh` }} />
            )}
            <span className={`hidden sm:block absolute top-2 ${dset.top.side === "left" ? "right-3" : "left-3"} text-xs ${blank ? "text-neutral-400" : shown ? "text-green-400" : "text-neutral-500"}`}>
              {blank ? "● Écran noir" : shown ? "● À l'écran" : "○ Rien à l'écran"}
            </span>
            {shown && shown.kind === "other" && !blank && (
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs sm:text-sm text-neutral-400">Un autre opérateur utilise l'écran</div>
            )}
            {shown && shown.kind !== "other" && !blank && bandPreview && (
              <div className="absolute inset-0 flex flex-col justify-end" style={{ padding: "4cqh 6cqw" }}>
                <div className={`flex mb-[1cqh] ${shown.cols ? "justify-center" : logo && PB.logoOn && PB.logoSide === "right" ? "justify-start" : "justify-end"}`}>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] sm:text-xs ${shown.cols ? "text-amber-400" : ""} ${shown.ref ? "" : "hidden"}`}>{shown.ref} {shown.cols ? null : <span className="opacity-60">{shown.version}</span>}{shown.page && <span className="ml-1 text-amber-300">{shown.page.i + 1}/{shown.page.n}</span>}</span>
                </div>
                <div className={`relative flex items-stretch gap-[2cqw] rounded-md px-[2.5cqw] ${PB.logoSide === "left" ? "" : "flex-row-reverse"}`} style={{ height: `${PB.height}cqh` }}>
                  {false && (
                    <img src={logo} alt="" draggable={false} className="shrink-0 w-auto object-contain self-start pointer-events-none select-none" style={{ height: `${PB.logoSize}cqh`, marginTop: `${-PB.logoRise}cqh` }} />
                  )}
                  <div className="flex-1 min-w-0 h-full overflow-hidden flex items-center">
                    <p ref={shown.kind === "chant" ? undefined : previewTxt}
                       className={`w-full leading-tight whitespace-pre-line ${shown.kind === "chant" ? "font-sans font-bold text-center" : `font-serif cursor-text ${shown.kind === "slide" ? "text-center" : ""}`}`}
                       style={{ fontSize: "clamp(9px, 4.6cqh, 20px)" }}>
                      {shown.kind === "chant" ? shown.text : shown.cols ? <ColsText cols={shown.cols} /> : <RichText text={shown.text} bold={shown.bold} under={shown.under} />}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {shown && shown.kind !== "other" && !blank && !bandPreview && (
              <div className={`absolute inset-0 flex flex-col overflow-y-auto ${shown.kind === "media" ? "justify-center" : { top: "justify-start", center: "justify-center", bottom: "justify-end" }[PF.valign]}`}
                   style={{ padding: `max(${PF.padTop}cqh, 1.4rem) ${PF.padX}cqw ${PF.padBottom}cqh` }}>
                {false && shown.kind !== "media" && (
                  <img src={logo} alt="" draggable={false} className="absolute w-auto object-contain pointer-events-none select-none" style={{ top: "2cqh", right: "2cqw", height: `${PF.logoSize}cqh` }} />
                )}
                <div className="w-full">
                {shown.kind === "media" ? (
                  <div className="relative flex items-center justify-center">
                    {shown.mediaType === "image" ? <img src={shown.url} referrerPolicy="no-referrer" alt="" className="max-h-20 sm:max-h-40 object-contain rounded" /> : <span className="text-3xl">🎬</span>}
                    {shown.overlay && (
                      <div className="absolute inset-x-0 bottom-0 rounded bg-black/75 px-1.5 py-1 text-center">
                        <p className="font-serif text-[9px] sm:text-[11px] leading-tight line-clamp-3">{shown.overlay.text}</p>
                        <p className="text-[9px] sm:text-[10px] text-amber-300">{shown.overlay.ref}</p>
                      </div>
                    )}
                  </div>
                ) : shown.kind === "chant" ? (
                  <>
                    <p className={`font-sans font-bold leading-snug whitespace-pre-line text-center ${size}`}>{shown.text}</p>
                  </>
                ) : (
                  <>
                    <p ref={previewTxt} className={`font-serif leading-snug whitespace-pre-line cursor-text ${shown.kind === "slide" ? "text-center" : ""} ${size}`}>{shown.cols ? <ColsText cols={shown.cols} /> : <RichText text={shown.text} bold={shown.bold} under={shown.under} />}</p>
                    <div className={`mt-2 text-sm ${shown.ref ? "" : "hidden"} ${shown.cols ? "text-center font-semibold text-amber-400" : "text-right"}`}>{shown.ref} {shown.cols ? null : <span className="text-xs opacity-60">{shown.version}</span>}{shown.page && <span className="ml-1 text-xs text-amber-300">{shown.page.i + 1}/{shown.page.n}</span>}</div>
                  </>
                )}
                </div>
              </div>
            )}
          </div>

          {tab !== "annonces" && peers.length > 0 && (
            <p className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 ${lastBy ? "bg-sky-500/15 text-sky-200" : "bg-neutral-800 text-neutral-400"}`}>
              {lastBy ? <><b className="font-medium">{lastBy.name}</b> <span className="opacity-70">({lastBy.device})</span> · {lastBy.what}</> : "C'est vous qui pilotez l'écran"}
            </p>
          )}

          {["assistant", "orateur"].includes(church.role) && (
            canProject
              ? <p className="mt-2 text-xs rounded-lg px-2.5 py-2 bg-sky-500/15 text-sky-200">Vous pouvez projeter : l'administrateur vous a autorisé. Il peut passer par-dessus à tout moment.</p>
              : <p className="mt-2 text-xs rounded-lg px-2.5 py-2 bg-amber-400/10 text-amber-200">{helperIds.length ? "L'administrateur a autorisé d'autres personnes." : "L'aide n'est pas activée."} Vous pouvez suivre l'écran, mais pas projeter tant que l'administrateur ne vous a pas autorisé.</p>
          )}

          {hint && <p className="mt-2 text-xs rounded-lg px-2.5 py-2 bg-amber-400/10 text-amber-200">{hint}</p>}

          {tab !== "annonces" && shown && shown.kind === "media" && shown.mediaType === "image" && !blank && (
            <OverlayVerse bible={bible} refOf={refOf} textOf={textOf} overlay={shown.overlay || null}
              onPick={projectOverlay} onClear={clearOverlay} disabled={!canProject} />
          )}

          {tab !== "annonces" && <div className="grid grid-cols-[1.4fr_1.4fr_1fr_0.6fr_0.6fr_1.2fr] lg:grid-cols-6 gap-1.5 lg:gap-2 mt-2 lg:mt-3">
            <button className={btn + " lg:col-span-3"} disabled={!canStep} onClick={() => step(-1)}>← Préc.</button>
            <button className={btn + " lg:col-span-3"} disabled={!canStep} onClick={() => step(1)}>Suiv. →</button>
            <button onClick={toggleBlank} disabled={!canProject}
              className={`lg:col-span-2 rounded-lg py-2 text-sm transition duration-100 active:scale-95 ${blank ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 hover:bg-neutral-700"}`}>Noir</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={applyBold} disabled={!canProject} title="Gras sur les mots sélectionnés dans l'aperçu (Ctrl+B)" aria-label="Gras"
              className={btn + " lg:col-span-1 font-bold"}>B</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={applyUnder} disabled={!canProject} title="Souligné sur les mots sélectionnés dans l'aperçu (Ctrl+U)" aria-label="Souligné"
              className={btn + " lg:col-span-1 underline"}>U</button>
            <button className={btn + " lg:col-span-2"} disabled={!shown || !canProject} onClick={clearScreen}>Effacer</button>
          </div>}

          {tab !== "annonces" && !isOrateur && (
          <div className="mt-2 lg:mt-3 grid grid-cols-2 gap-1 rounded-lg bg-neutral-800 p-1" role="group" aria-label="Mise en page de l'écran">
            {[["full", "Plein écran"], ["band", "Bandeau"]].map(([k, l]) => (
              <button key={k} onClick={() => setLayoutMode(k)} disabled={!canProject} aria-pressed={layout === k}
                className={`rounded-md py-1.5 text-sm transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${layout === k ? "bg-amber-400 text-black font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{l}</button>
            ))}
          </div>
          )}

          {tab !== "annonces" && <div className="hidden lg:flex mt-4 flex-col items-center gap-2.5 text-xs xl:text-sm text-neutral-400">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5"><Kbd>↑↓</Kbd> choisir</span>
              <span className="flex items-center gap-1.5"><Kbd>Entrée</Kbd> projeter</span>
              <span className="flex items-center gap-1.5"><Kbd>←→</Kbd> naviguer</span>
              {planOn && <span className="flex items-center gap-1.5"><Kbd>Page ↓↑</Kbd> plan du culte</span>}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5"><Kbd>Échap</Kbd> effacer</span>
              <span className="flex items-center gap-1.5"><Kbd>Ctrl+E</Kbd> écran noir</span>
              <span className="flex items-center gap-1.5"><Kbd>Ctrl+B</Kbd> gras</span>
              <span className="flex items-center gap-1.5"><Kbd>Ctrl+U</Kbd> souligné</span>
              {!isOrateur && <span className="flex items-center gap-1.5"><Kbd>B</Kbd> bandeau</span>}
            </div>
          </div>}

          {wide && tabs.includes("bible") && tab === "bible" && (
            <div className="hidden lg:block mt-3 space-y-2">
              <button onClick={toggleCompare} aria-pressed={compare}
                className={`w-full rounded-lg py-1.5 text-sm transition duration-100 active:scale-95 ${compare ? "bg-amber-400 text-black font-medium" : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"}`}>
                ⇄ {compare ? "Fermer la comparaison" : "Comparer 2 versions"}
              </button>
              {compare && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0"><p className="mb-1 text-[11px] text-neutral-500">Version 1</p><VersionSelect versions={versions} value={version} onChange={setVersion} loading={loading} /></div>
                    <div className="min-w-0"><p className="mb-1 text-[11px] text-neutral-500">Version 2</p><VersionSelect versions={versions} value={version2} onChange={setVersion2} /></div>
                  </div>
                  <div className="rounded-lg border border-neutral-700 bg-neutral-800/60 p-2.5 text-sm leading-snug max-h-64 overflow-y-auto">
                    {bothTarget && bible?.[bothTarget.b]?.[bothTarget.c] ? (
                      <>
                        <p className="text-xs font-medium text-neutral-300 mb-1.5">{refOf(bothTarget)}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="min-w-0">
                            <p className="mb-1 text-[11px] font-semibold text-blue-400">{label}</p>
                            <p className="text-neutral-200">{textOf(bothTarget)}</p>
                          </div>
                          <div className="min-w-0 border-l border-neutral-700 pl-3">
                            <p className="mb-1 text-[11px] font-semibold text-amber-400">{label2 || "…"}</p>
                            <p className="text-neutral-200">{bible2?.[bothTarget.b]?.[bothTarget.c] && chapterReady2(bothTarget.b, bothTarget.c) ? (textOf(bothTarget, bible2) || "Verset absent de cette version.") : (bibleError2 ? `Version indisponible : ${bibleError2}` : "Chargement…")}</p>
                          </div>
                        </div>
                      </>
                    ) : <p className="text-xs text-neutral-500">Choisis ou projette un verset : il s'affiche ici dans les 2 versions.</p>}
                  </div>
                  <button onClick={() => bothTarget && projectBoth(bothTarget)} disabled={!canProject || !bothReady}
                    className="w-full rounded-lg py-1.5 text-sm font-medium bg-amber-400 text-black transition duration-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                    Afficher sur l'écran
                  </button>
                  {liveBoth && <p className="text-[11px] text-green-400">● Les 2 versions sont à l'écran</p>}
                </div>
              )}
            </div>
          )}

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
