"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_IDS, roleLabel, roleDesc } from "@/lib/roles";
import { useT, useLocale, useSetLocale } from "@/lib/i18n/client";
import { LOCALES, LOCALE_IDS, makeT } from "@/lib/i18n";
import { fetchChurchSettings, saveChurchSettings, saveChurchSettingsSoon, migrateLegacy, appliedOf, watchChurchSettings, cacheLocally } from "@/lib/churchSettings";
import { openScreen } from "@/lib/screen";
import Backgrounds, { MAX_BG, DEFAULT_TEXT, bgStyle } from "../control/Backgrounds";
import DisplaySettings from "../control/DisplaySettings";
import { DEFAULT_SETTINGS, mergeSettings, resizeLogo, LOGO_MAX, LIMITS } from "@/lib/displaySettings";

const card = "rounded-xl bg-neutral-800/60 border border-neutral-700 p-4";
const field = "rounded-lg bg-neutral-900 border border-neutral-600 px-3 py-2 text-sm outline-none focus:border-amber-400 w-full";
const select = "rounded-lg bg-neutral-800 border border-neutral-600 px-2 py-1.5 text-sm outline-none focus:border-amber-400";

export default function AdminPanel({ churchName, churchId, token, defaultLocale = "fr" }) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [churchLocale, setChurchLocale] = useState(defaultLocale);
  const [langSaved, setLangSaved] = useState(false);
  const [members, setMembers] = useState(null);
  const [msg, setMsg] = useState(null);
  const [section, setSection] = useState("profils");     // section affichée à droite : "profils" | "fond" | "affichage" | "langue"
  const db = () => createClient();

  // fond / texte / logo : on prépare d'abord (brouillon + aperçu), puis « Appliquer » les envoie à l'écran
  const [bgs, setBgs] = useState(() => Array(MAX_BG).fill(null));
  const [bgActive, setBgActive] = useState(-1);                       // fond choisi (brouillon)
  const [textColor, setTextColor] = useState(DEFAULT_TEXT);           // couleur du texte choisie (brouillon)
  const [logo, setLogo] = useState(null);                             // logo choisi (brouillon)
  const [topLogo, setTopLogo] = useState(DEFAULT_SETTINGS.top);       // position / taille du logo (brouillon)
  const [applied, setApplied] = useState({ bg: null, text: DEFAULT_TEXT, logo: null });   // ce qui est vraiment sur l'écran
  const [dset, setDset] = useState(DEFAULT_SETTINGS);
  const dsetRef = useRef(DEFAULT_SETTINGS);
  const appliedRef = useRef({ bg: null, text: DEFAULT_TEXT, logo: null });
  const scr = useRef(null);
  const bgsRef = useRef({});                                     // dernier état enregistré { slots, active, textColor, applied }
  const logoRef = useRef(null);
  // lit les réglages de l'église (table church_settings) et les met dans le formulaire ; reprend l'ancien stockage du navigateur si l'église n'a encore rien
  const loadShared = useCallback(async () => {
    let { data } = await fetchChurchSettings(churchId);
    if (!data) { const legacy = await migrateLegacy(churchId); if (legacy) data = legacy; }
    const saved = data?.bgs || {};
    const slots = Array.from({ length: MAX_BG }, (_, i) => saved?.slots?.[i] || null);
    const ap = { ...appliedOf(saved), logo: data?.logo || null };
    bgsRef.current = { slots, active: slots[saved?.active] ? saved.active : -1, textColor: saved?.textColor || DEFAULT_TEXT, applied: { bg: ap.bg, text: ap.text } };
    logoRef.current = ap.logo;
    setBgs(slots); setBgActive(bgsRef.current.active); setTextColor(bgsRef.current.textColor);
    appliedRef.current = ap; setApplied(ap); setLogo(ap.logo);
    dsetRef.current = mergeSettings(data?.display); setDset(dsetRef.current); setTopLogo(dsetRef.current.top);
    if (data?.default_locale) setChurchLocale(data.default_locale);
    cacheLocally({ display: dsetRef.current, logo: ap.logo });
  }, [churchId]);
  useEffect(() => {
    loadShared();
    scr.current = openScreen(token, (m) => {
      // l'écran vient de s'ouvrir et demande son fond, la couleur du texte et ses réglages (ce qui est appliqué, pas le brouillon)
      if (m.type === "bg?" || m.type === "display?") {
        const a = appliedRef.current;
        scr.current?.postMessage({ type: "bg", bg: a.bg, textColor: a.text });
        scr.current?.postMessage({ type: "settings", settings: dsetRef.current });
        if (a.logo) scr.current?.postMessage({ type: "logo", logo: a.logo });
      }
    });
    return () => scr.current?.close();
  }, [churchId, token, loadShared]);

  // un autre administrateur modifie les réglages : on recharge (sans écraser un brouillon en cours de saisie)
  useEffect(() => watchChurchSettings(churchId, () => { if (!dirtyRef.current) loadShared(); }), [churchId, loadShared]);

  // fonds préparés : enregistrés pour toute l'église (un seul envoi, les images sont déjà réduites)
  const persist = (slots, active, tc, ap) => {
    const next = { slots, active, textColor: tc, applied: { bg: ap.bg, text: ap.text } };
    bgsRef.current = next;
    saveChurchSettings(churchId, { bgs: next }).then((err) => { if (err) setMsg(t("admin.saveFail", { msg: err.message })); });
    return true;
  };
  const draftBg = bgs[bgActive] || null;
  const dirtyRef = useRef(false);
  const dirty = draftBg !== applied.bg || textColor !== applied.text || logo !== applied.logo || topLogo.side !== dset.top.side || topLogo.size !== dset.top.size;
  dirtyRef.current = dirty;
  const pickBg = (i) => { setBgActive(i); persist(bgs, i, textColor, appliedRef.current); };
  const setBgSlot = (i, bg) => { const slots = bgs.map((x, k) => (k === i ? bg : x)); setBgs(slots); persist(slots, bgActive, textColor, appliedRef.current); };
  const removeBg = (i) => {
    const slots = bgs.map((x, k) => (k === i ? null : x)); const act = bgActive === i ? -1 : bgActive;
    setBgs(slots); setBgActive(act); persist(slots, act, textColor, appliedRef.current);
  };
  const pickText = (c) => { setTextColor(c); persist(bgs, bgActive, c, appliedRef.current); };

  // « Appliquer » : n'envoie à l'écran que ce qui a changé (fond, texte, logo)
  const applyAll = () => {
    const prev = appliedRef.current;
    const next = { bg: draftBg, text: textColor, logo };
    if (!persist(bgs, bgActive, textColor, next)) return;
    if (next.bg !== prev.bg || next.text !== prev.text) scr.current?.postMessage({ type: "bg", bg: next.bg, textColor: next.text });
    if (next.logo !== prev.logo) { logoRef.current = next.logo; cacheLocally({ logo: next.logo }); saveChurchSettings(churchId, { logo: next.logo }).then((err) => err && setMsg(t("admin.saveFail", { msg: err.message }))); scr.current?.postMessage({ type: "logo", logo: next.logo }); }
    if (topLogo.side !== dsetRef.current.top.side || topLogo.size !== dsetRef.current.top.size) changeSettings(mergeSettings({ ...dsetRef.current, top: topLogo }));
    appliedRef.current = next; setApplied(next);
  };
  // « Annuler » : revient à ce qui est affiché sur l'écran
  const resetDraft = () => {
    const a = appliedRef.current;
    setBgActive(bgs.findIndex((x) => x && x === a.bg)); setTextColor(a.text); setLogo(a.logo); setTopLogo(dsetRef.current.top);
  };

  // réglages d'affichage : enregistrés tout de suite, envoyés à l'écran et aux consoles
  const changeSettings = (c) => {
    dsetRef.current = c; setDset(c); cacheLocally({ display: c, logo: logoRef.current });
    saveChurchSettingsSoon(churchId, { display: c });
    scr.current?.postMessage({ type: "settings", settings: c });
  };
  const [logoErr, setLogoErr] = useState("");
  const pickLogo = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { setLogoErr(""); setLogo(await resizeLogo(f)); }
    catch (err) { setLogoErr(err.message === "png" ? t("admin.logo.notPng") : t("admin.logo.unreadable")); }
  };

  // création directe d'un profil (email + mot de passe provisoire)
  const EMPTY = { first: "", last: "", email: "", password: "", role: "standard" };
  const [form, setForm] = useState(null);             // null = formulaire fermé
  const [creating, setCreating] = useState(false);
  const [made, setMade] = useState(null);             // profil qui vient d'être créé { email, password }
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = crypto.getRandomValues(new Uint32Array(10));
    setForm((f) => ({ ...f, password: Array.from(r, (n) => chars[n % chars.length]).join("") }));
  };
  const createMember = async (e) => {
    e.preventDefault(); setMsg(null); setCreating(true);
    try {
      const res = await fetch("/api/admin/create-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(out.error || t("admin.createFail")); return; }
      setMade({ email: form.email, password: form.password, first: form.first, roleId: form.role });
      setForm(null);
      await load();
    } catch { setMsg(t("admin.connFail")); }
    finally { setCreating(false); }
  };

  const load = useCallback(async () => {
    const m = await db().rpc("list_members");
    if (m.error) setMsg(m.error.message); else setMembers(m.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  // message d'accueil envoyé à la personne (WhatsApp ou copie)
  const [waNum, setWaNum] = useState("");
  const welcome = (m) => {
    const tt = makeT(churchLocale);                      // message écrit dans la langue par défaut de l'église
    const why = tt(`admin.why.${m.roleId}`);
    return tt("admin.welcome", { name: m.first || "", why: why.startsWith("admin.why.") ? tt("admin.why.standard") : why, link: `${location.origin}/login`, email: m.email, password: m.password });
  };
  const sendWhatsApp = (m) => {
    const num = waNum.replace(/\D/g, "");              // chiffres seulement, avec l'indicatif du pays (ex. 230 57123456)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(welcome(m))}`, "_blank", "noopener");
  };

  // modifier / supprimer un profil (API serveur : le compte lui-même est modifié ou supprimé)
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const setE = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));
  const api = async (method, body) => {
    const res = await fetch("/api/admin/member", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || t("admin.actionFail"));
  };
  const startEdit = (u) => { setMsg(null); setMade(null); setEditId(u.user_id); setEdit({ first: u.first_name || "", last: u.last_name || "", email: u.email || "", role: u.role, password: "" }); };
  const genEditPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const r = crypto.getRandomValues(new Uint32Array(10));
    setEdit((x) => ({ ...x, password: Array.from(r, (n) => chars[n % chars.length]).join("") }));
  };
  const saveEdit = async (e) => {
    e.preventDefault(); setMsg(null); setSaving(true);
    try {
      await api("PATCH", { userId: editId, ...edit });
      if (edit.password) setMade({ title: t("admin.updated"), email: edit.email, password: edit.password, first: edit.first, roleId: edit.role });
      setEditId(null); setEdit(null);
      await load();
    } catch (err) { setMsg(err.message); }
    finally { setSaving(false); }
  };
  const remove = async (u) => {
    if (!confirm(t("admin.confirmDelete", { name: u.first_name || u.email }))) return;
    setMsg(null);
    try { await api("DELETE", { userId: u.user_id }); if (editId === u.user_id) { setEditId(null); setEdit(null); } }
    catch (err) { setMsg(err.message); }
    await load();
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
            <p className="text-sm text-neutral-400">{churchName}</p>
          </div>
          <a href="/control" className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5">{t("admin.back")}</a>
        </header>

        {msg && <p className="text-sm text-amber-300 bg-amber-400/10 rounded-lg px-3 py-2">{msg}</p>}

        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] items-start">
          {/* menu : titres à gauche (onglets en haut sur téléphone) */}
          <nav className="flex md:flex-col gap-1 rounded-xl bg-neutral-800/60 border border-neutral-700 p-2">
            {[["profils", t("admin.nav.profils")], ["fond", t("admin.nav.fond")], ["affichage", t("admin.nav.affichage")], ["langue", t("admin.nav.langue")]].map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)}
                className={`flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm transition duration-100 active:scale-95 ${section === k ? "bg-amber-400 text-white font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{l}</button>
            ))}
          </nav>

          {/* détails de la section choisie */}
          <div className="min-w-0">
          {section === "profils" && (
        <section className={card}>
          <h2 className="font-medium mb-1">{t("admin.profiles")}</h2>
          <p className="text-sm text-neutral-400 mb-3">{t("admin.profilesDesc")}</p>
          <ul className="text-sm text-neutral-400 space-y-1">
            {ROLE_IDS.map((r) => <li key={r}><b className="text-neutral-200 font-medium">{roleLabel(t, r)}</b> : {roleDesc(t, r)}</li>)}
          </ul>
        <div className="mt-5 pt-4 border-t border-neutral-700">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-medium">{t("admin.team")}</h3>
            {!form && <button onClick={() => { setMade(null); setForm({ ...EMPTY }); }} className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5 active:scale-95 transition duration-100">{t("admin.addMember")}</button>}
          </div>

          {made && (
            <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/40 p-3 text-sm">
              <p className="text-green-300 font-medium mb-1">{made.title || t("admin.created")}</p>
              <p className="text-neutral-300">{t("admin.emailLabel")} <b className="font-medium">{made.email}</b><br />{t("admin.tempPasswordLabel")} <b className="font-mono">{made.password}</b></p>
              <p className="text-xs text-neutral-400 mt-1">{t("admin.mustChange")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={waNum} onChange={(e) => setWaNum(e.target.value)} inputMode="tel" placeholder={t("admin.waPlaceholder")} className={field + " flex-1 min-w-[12rem]"} />
                <button onClick={() => sendWhatsApp(made)} className="rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium text-sm px-3.5 py-2 active:scale-95 transition duration-100">{t("admin.waSend")}</button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{t("admin.waHint")}</p>
              <button onClick={() => navigator.clipboard?.writeText(welcome(made))} className="mt-2 text-amber-400 hover:underline">{t("admin.copyMessage")}</button>
              <button onClick={() => setMade(null)} className="mt-2 ml-4 text-neutral-400 hover:text-white">{t("common.close")}</button>
            </div>
          )}

          {form && (
            <form onSubmit={createMember} className="mb-4 rounded-lg bg-neutral-800 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input required placeholder={t("admin.first")} value={form.first} onChange={setF("first")} className={field} />
                <input placeholder={t("admin.last")} value={form.last} onChange={setF("last")} className={field} />
              </div>
              <input required type="email" placeholder={t("admin.email")} value={form.email} onChange={setF("email")} className={field} />
              <div className="flex gap-2">
                <input required minLength={8} placeholder={t("admin.tempPasswordField")} value={form.password} onChange={setF("password")} className={field + " flex-1 min-w-0"} />
                <button type="button" onClick={genPassword} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-3">{t("admin.generate")}</button>
              </div>
              <select value={form.role} onChange={setF("role")} className={select + " w-full"}>
                {ROLE_IDS.map((r) => <option key={r} value={r}>{roleLabel(t, r)} : {roleDesc(t, r)}</option>)}
              </select>
              <div className="flex gap-2 pt-1">
                <button disabled={creating} className="flex-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-medium text-sm py-2">{creating ? t("admin.creating") : t("admin.create")}</button>
                <button type="button" onClick={() => setForm(null)} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-4">{t("common.cancel")}</button>
              </div>
            </form>
          )}
          {!members ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : (
            <ul className="divide-y divide-neutral-700">
              {members.map((u) => editId === u.user_id && edit ? (
                <li key={u.user_id} className="py-3">
                  <form onSubmit={saveEdit} className="rounded-lg bg-neutral-800 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input required placeholder={t("admin.first")} value={edit.first} onChange={setE("first")} className={field} />
                      <input placeholder={t("admin.last")} value={edit.last} onChange={setE("last")} className={field} />
                    </div>
                    <input required type="email" placeholder={t("admin.email")} value={edit.email} onChange={setE("email")} className={field} />
                    <select value={edit.role} onChange={setE("role")} className={select + " w-full"}>
                      {ROLE_IDS.map((r) => <option key={r} value={r}>{roleLabel(t, r)} : {roleDesc(t, r)}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input minLength={8} placeholder={t("admin.newPasswordField")} value={edit.password} onChange={setE("password")} className={field + " flex-1 min-w-0"} />
                      <button type="button" onClick={genEditPassword} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-3">{t("admin.generate")}</button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button disabled={saving} className="flex-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-medium text-sm py-2">{saving ? t("common.saving") : t("common.save")}</button>
                      <button type="button" onClick={() => { setEditId(null); setEdit(null); }} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-4">{t("common.cancel")}</button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={u.user_id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-sm truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} {u.is_me && <span className="text-xs text-amber-300">{t("admin.you")}</span>}</div>
                    <div className="text-xs text-neutral-500 truncate">{u.email}</div>
                  </div>
                  <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs text-amber-300">{ROLE_IDS.includes(u.role) ? roleLabel(t, u.role) : u.role}</span>
                  <button onClick={() => startEdit(u)} className="text-sm text-neutral-300 hover:text-amber-300">{t("common.edit")}</button>
                  <button onClick={() => remove(u)} disabled={u.is_me} className="text-sm text-neutral-400 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none">{t("common.delete")}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </section>
          )}

          {section === "fond" && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="font-medium">{t("admin.bg.title")}</h2>
            <span className="text-xs text-neutral-500">{t("admin.bg.max")}</span>
          </div>
          <p className="text-sm text-neutral-400 mb-3">{t("admin.bg.desc")}</p>
          <Backgrounds slots={bgs} active={bgActive} onPick={pickBg} onSet={setBgSlot} onRemove={removeBg} textColor={textColor} onText={pickText} />
          <div className="mt-4 pt-3 border-t border-neutral-700">
            <div className="text-sm font-medium mb-1">{t("admin.logo.title")}</div>
            <p className="text-xs text-neutral-400 mb-2">{t("admin.logo.desc", { max: LOGO_MAX })}</p>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center overflow-hidden">
                {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-neutral-600">{t("admin.logo.none")}</span>}
              </div>
              <label className="rounded-md bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 text-sm cursor-pointer active:scale-95 transition duration-100">
                {logo ? t("admin.logo.change") : t("admin.logo.add")}
                <input type="file" accept="image/png" className="hidden" onChange={pickLogo} />
              </label>
              {logo && <button type="button" onClick={() => setLogo(null)} className="text-sm text-neutral-400 hover:text-red-400">{t("admin.logo.remove")}</button>}
            </div>
            {logoErr && <p className="text-xs text-amber-300 mt-2">{logoErr}</p>}
            {logo && (
              <div className="mt-3 max-w-md space-y-3">
                <div>
                  <span className="block text-xs text-neutral-300 mb-1">{t("admin.logo.position")}</span>
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-neutral-900 p-0.5" role="group" aria-label={t("admin.logo.position")}>
                    {[["left", t("admin.logo.topLeft")], ["right", t("admin.logo.topRight")]].map(([k, l]) => (
                      <button key={k} type="button" aria-pressed={topLogo.side === k} onClick={() => setTopLogo((t) => ({ ...t, side: k }))}
                        className={`rounded py-1.5 text-xs transition active:scale-95 ${topLogo.side === k ? "bg-amber-400 text-black font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="flex justify-between text-xs text-neutral-300 mb-0.5"><span>{t("admin.logo.size")}</span><span className="tabular-nums text-neutral-400">{t("admin.logo.sizeMax", { size: topLogo.size, px: Math.round(LOGO_MAX * topLogo.size / 100) })}</span></span>
                  <input type="range" min={LIMITS.top.size[0]} max={LIMITS.top.size[1]} step="1" value={topLogo.size} onChange={(e) => setTopLogo((t) => ({ ...t, size: +e.target.value }))} className="w-full accent-amber-400" />
                </label>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-700">
            <div className="text-sm font-medium mb-2">{t("admin.preview.title")}</div>
            <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border border-neutral-600 bg-black" style={bgStyle(draftBg)}>
              <span className="absolute inset-0 flex items-center justify-center text-center font-bold text-lg px-4 select-none" style={{ color: textColor }}>{t("admin.preview.text")}</span>
              {logo && <img src={logo} alt="" draggable={false} className="absolute object-contain pointer-events-none select-none" style={{ top: "2%", [topLogo.side === "left" ? "left" : "right"]: "2%", maxWidth: `${13 * topLogo.size / 100}%`, maxHeight: `${23 * topLogo.size / 100}%` }} />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={applyAll} disabled={!dirty}
                className="rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none text-black font-medium text-sm px-5 py-2 active:scale-95 transition duration-100">{t("admin.apply")}</button>
              {dirty && <button type="button" onClick={resetDraft} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-4 py-2">{t("common.cancel")}</button>}
              <span className={`text-xs ${dirty ? "text-amber-300" : "text-green-400"}`}>{dirty ? t("admin.dirty") : t("admin.clean")}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3">{t("admin.sharedNote")}</p>
        </section>
          )}

          {section === "affichage" && (
        <section className={card}>
          <h2 className="font-medium mb-1">{t("admin.display.title")}</h2>
          <p className="text-sm text-neutral-400 mb-3">{t("admin.display.desc", { link: "\u0000" }).split("\u0000").flatMap((part, n) => (n ? [<a key="open" href={`/display?k=${token}`} target="_blank" className="text-amber-400 hover:underline">{t("admin.display.open")}</a>, part] : [part]))}</p>
          <DisplaySettings standalone settings={dset} logo={applied.logo} onSettings={changeSettings} />
          <p className="text-xs text-neutral-500 mt-4">{t("admin.sharedNote")}</p>
        </section>
          )}

          {section === "langue" && (
        <section className={card}>
          <h2 className="font-medium mb-3">{t("admin.lang.title")}</h2>
          <div className="space-y-5">
            <div>
              <div className="text-sm font-medium">{t("admin.lang.mine")}</div>
              <p className="text-xs text-neutral-400 mb-2">{t("admin.lang.mineDesc")}</p>
              <div className="inline-grid grid-flow-col gap-0.5 rounded-lg bg-neutral-900 border border-neutral-700 p-0.5" role="group" aria-label={t("admin.lang.mine")}>
                {LOCALE_IDS.map((id) => (
                  <button key={id} type="button" aria-pressed={locale === id} onClick={() => locale !== id && setLocale(id)}
                    className={`rounded-md px-4 py-1.5 text-sm transition duration-100 active:scale-95 ${locale === id ? "bg-amber-400 text-black font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{LOCALES[id]}</button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-neutral-700">
              <div className="text-sm font-medium">{t("admin.lang.church")}</div>
              <p className="text-xs text-neutral-400 mb-2">{t("admin.lang.churchDesc")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <select value={churchLocale} className={select} onChange={async (e) => {
                  const v = e.target.value; setChurchLocale(v); setLangSaved(false);
                  const err = await saveChurchSettings(churchId, { default_locale: v });
                  if (err) setMsg(t("admin.saveFail", { msg: err.message })); else { setLangSaved(true); setTimeout(() => setLangSaved(false), 2000); }
                }}>
                  {LOCALE_IDS.map((id) => <option key={id} value={id}>{LOCALES[id]}</option>)}
                </select>
                {langSaved && <span className="text-xs text-green-400">{t("admin.lang.saved")}</span>}
              </div>
            </div>
          </div>
        </section>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
