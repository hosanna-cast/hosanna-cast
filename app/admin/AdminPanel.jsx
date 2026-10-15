"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, ROLE_IDS } from "@/lib/roles";
import { openScreen } from "@/lib/screen";
import Backgrounds, { MAX_BG, DEFAULT_TEXT } from "../control/Backgrounds";

const card = "rounded-xl bg-neutral-800/60 border border-neutral-700 p-4";
const field = "rounded-lg bg-neutral-900 border border-neutral-600 px-3 py-2 text-sm outline-none focus:border-amber-400 w-full";
const select = "rounded-lg bg-neutral-800 border border-neutral-600 px-2 py-1.5 text-sm outline-none focus:border-amber-400";

export default function AdminPanel({ churchName, churchId, token }) {
  const [members, setMembers] = useState(null);
  const [msg, setMsg] = useState(null);
  const [section, setSection] = useState("profils");     // section affichée à droite : "profils" | "fond"
  const db = () => createClient();

  // fond de l'écran : 3 maximum, un seul actif ; gardé dans ce navigateur et envoyé à l'écran
  const [bgs, setBgs] = useState(() => Array(MAX_BG).fill(null));
  const [bgActive, setBgActive] = useState(-1);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT);          // couleur du texte projeté
  const scr = useRef(null);
  const activeRef = useRef(null);
  const textRef = useRef(DEFAULT_TEXT);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hc.bgs." + churchId));
      const slots = Array.from({ length: MAX_BG }, (_, i) => saved?.slots?.[i] || null);
      setBgs(slots); setBgActive(slots[saved?.active] ? saved.active : -1);
      activeRef.current = slots[saved?.active] || null;
      textRef.current = saved?.textColor || DEFAULT_TEXT;
      setTextColor(textRef.current);
    } catch {}
    scr.current = openScreen(token, (m) => {
      // l'écran vient de s'ouvrir et demande son fond et la couleur du texte
      if (m.type === "bg?") scr.current?.postMessage({ type: "bg", bg: activeRef.current, textColor: textRef.current });
    });
    return () => scr.current?.close();
  }, [churchId, token]);
  const saveBgs = (slots, active, tc = textRef.current) => {
    setBgs(slots); setBgActive(active);
    activeRef.current = slots[active] || null;
    textRef.current = tc; setTextColor(tc);
    try { localStorage.setItem("hc.bgs." + churchId, JSON.stringify({ slots, active, textColor: tc })); } catch { setMsg("Impossible d'enregistrer ce fond : mémoire du navigateur pleine."); }
  };
  const sendBg = (bg, tc = textRef.current) => scr.current?.postMessage({ type: "bg", bg, textColor: tc });
  const pickBg = (i) => { saveBgs(bgs, i); sendBg(i >= 0 ? bgs[i] : null); };
  const setBgSlot = (i, bg) => { saveBgs(bgs.map((x, k) => (k === i ? bg : x)), bgActive); if (bgActive === i) sendBg(bg); };
  const removeBg = (i) => {
    const was = bgActive === i;
    saveBgs(bgs.map((x, k) => (k === i ? null : x)), was ? -1 : bgActive);
    if (was) sendBg(null);
  };
  const pickText = (c) => { saveBgs(bgs, bgActive, c); sendBg(activeRef.current, c); };

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
      if (!res.ok) { setMsg(out.error || "Création impossible."); return; }
      setMade({ email: form.email, password: form.password, first: form.first, roleId: form.role });
      setForm(null);
      await load();
    } catch { setMsg("Connexion impossible. Réessayez."); }
    finally { setCreating(false); }
  };

  const load = useCallback(async () => {
    const m = await db().rpc("list_members");
    if (m.error) setMsg(m.error.message); else setMembers(m.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  // message d'accueil envoyé à la personne (WhatsApp ou copie)
  const [waNum, setWaNum] = useState("");
  const WHY = {
    standard: "projeter les paroles (lyrics) des chants",
    assistant: "aider à projeter les versets, les notes et les chants",
    admin: "gérer l'équipe et projeter les versets, les notes et les chants",
  };
  const welcome = (m) => `Bonjour ${m.first || ""} 🙏\n\nBienvenue dans l'équipe ! 🚀 Un compte a été créé pour toi sur Hosanna Cast, pour que tu puisses ${WHY[m.roleId] || WHY.standard} \n\nLien : ${location.origin}/login\n\nTes identifiants :\nLogin : ${m.email}\nPassword : ${m.password}\n\n🔐 Par mesure de sécurité, tu dois changer ton mot de passe à ta première connexion.`;
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
    if (!res.ok) throw new Error(out.error || "Action impossible.");
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
      if (edit.password) setMade({ title: "Profil modifié ✓", email: edit.email, password: edit.password, first: edit.first, roleId: edit.role });
      setEditId(null); setEdit(null);
      await load();
    } catch (err) { setMsg(err.message); }
    finally { setSaving(false); }
  };
  const remove = async (u) => {
    if (!confirm(`Supprimer définitivement le profil de ${u.first_name || u.email} ?\nSon compte sera effacé et il ne pourra plus se connecter.`)) return;
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
            <h1 className="text-2xl font-semibold">Administration</h1>
            <p className="text-sm text-neutral-400">{churchName}</p>
          </div>
          <a href="/control" className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5">← Console</a>
        </header>

        {msg && <p className="text-sm text-amber-300 bg-amber-400/10 rounded-lg px-3 py-2">{msg}</p>}

        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] items-start">
          {/* menu : titres à gauche (onglets en haut sur téléphone) */}
          <nav className="flex md:flex-col gap-1 rounded-xl bg-neutral-800/60 border border-neutral-700 p-2">
            {[["profils", "Profils"], ["fond", "Fond de l'écran"]].map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)}
                className={`flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm transition duration-100 active:scale-95 ${section === k ? "bg-amber-400 text-white font-medium" : "text-neutral-300 hover:bg-neutral-700"}`}>{l}</button>
            ))}
          </nav>

          {/* détails de la section choisie */}
          <div className="min-w-0">
          {section === "profils" && (
        <section className={card}>
          <h2 className="font-medium mb-1">Profils</h2>
          <p className="text-sm text-neutral-400 mb-3">Ce que chaque profil peut faire.</p>
          <ul className="text-sm text-neutral-400 space-y-1">
            {ROLE_IDS.map((r) => <li key={r}><b className="text-neutral-200 font-medium">{ROLES[r].label}</b> : {ROLES[r].desc}</li>)}
          </ul>
        <div className="mt-5 pt-4 border-t border-neutral-700">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-medium">Équipe</h3>
            {!form && <button onClick={() => { setMade(null); setForm({ ...EMPTY }); }} className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5 active:scale-95 transition duration-100">+ Créer un profil</button>}
          </div>

          {made && (
            <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/40 p-3 text-sm">
              <p className="text-green-300 font-medium mb-1">{made.title || "Profil créé ✓"}</p>
              <p className="text-neutral-300">Email : <b className="font-medium">{made.email}</b><br />Mot de passe provisoire : <b className="font-mono">{made.password}</b></p>
              <p className="text-xs text-neutral-400 mt-1">À sa première connexion, la personne devra choisir son propre mot de passe.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={waNum} onChange={(e) => setWaNum(e.target.value)} inputMode="tel" placeholder="N° WhatsApp avec indicatif (facultatif)" className={field + " flex-1 min-w-[12rem]"} />
                <button onClick={() => sendWhatsApp(made)} className="rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium text-sm px-3.5 py-2 active:scale-95 transition duration-100">Envoyer par WhatsApp</button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Sans numéro, WhatsApp s'ouvre et tu choisis le contact.</p>
              <button onClick={() => navigator.clipboard?.writeText(welcome(made))} className="mt-2 text-amber-400 hover:underline">Copier le message</button>
              <button onClick={() => setMade(null)} className="mt-2 ml-4 text-neutral-400 hover:text-white">Fermer</button>
            </div>
          )}

          {form && (
            <form onSubmit={createMember} className="mb-4 rounded-lg bg-neutral-800 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input required placeholder="Prénom" value={form.first} onChange={setF("first")} className={field} />
                <input placeholder="Nom" value={form.last} onChange={setF("last")} className={field} />
              </div>
              <input required type="email" placeholder="Email" value={form.email} onChange={setF("email")} className={field} />
              <div className="flex gap-2">
                <input required minLength={8} placeholder="Mot de passe provisoire (8 car. min.)" value={form.password} onChange={setF("password")} className={field + " flex-1 min-w-0"} />
                <button type="button" onClick={genPassword} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-3">Générer</button>
              </div>
              <select value={form.role} onChange={setF("role")} className={select + " w-full"}>
                {ROLE_IDS.map((r) => <option key={r} value={r}>{ROLES[r].label} : {ROLES[r].desc}</option>)}
              </select>
              <div className="flex gap-2 pt-1">
                <button disabled={creating} className="flex-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-medium text-sm py-2">{creating ? "Création en cours…" : "Créer le profil"}</button>
                <button type="button" onClick={() => setForm(null)} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-4">Annuler</button>
              </div>
            </form>
          )}
          {!members ? <p className="text-sm text-neutral-500">Chargement…</p> : (
            <ul className="divide-y divide-neutral-700">
              {members.map((u) => editId === u.user_id && edit ? (
                <li key={u.user_id} className="py-3">
                  <form onSubmit={saveEdit} className="rounded-lg bg-neutral-800 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input required placeholder="Prénom" value={edit.first} onChange={setE("first")} className={field} />
                      <input placeholder="Nom" value={edit.last} onChange={setE("last")} className={field} />
                    </div>
                    <input required type="email" placeholder="Email" value={edit.email} onChange={setE("email")} className={field} />
                    <select value={edit.role} onChange={setE("role")} className={select + " w-full"}>
                      {ROLE_IDS.map((r) => <option key={r} value={r}>{ROLES[r].label} : {ROLES[r].desc}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input minLength={8} placeholder="Nouveau mot de passe provisoire (laisser vide = inchangé)" value={edit.password} onChange={setE("password")} className={field + " flex-1 min-w-0"} />
                      <button type="button" onClick={genEditPassword} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-3">Générer</button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button disabled={saving} className="flex-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-medium text-sm py-2">{saving ? "Enregistrement…" : "Enregistrer"}</button>
                      <button type="button" onClick={() => { setEditId(null); setEdit(null); }} className="rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm px-4">Annuler</button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={u.user_id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-sm truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} {u.is_me && <span className="text-xs text-amber-300">(vous)</span>}</div>
                    <div className="text-xs text-neutral-500 truncate">{u.email}</div>
                  </div>
                  <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs text-amber-300">{ROLES[u.role]?.label || u.role}</span>
                  <button onClick={() => startEdit(u)} className="text-sm text-neutral-300 hover:text-amber-300">Modifier</button>
                  <button onClick={() => remove(u)} disabled={u.is_me} className="text-sm text-neutral-400 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none">Supprimer</button>
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
            <h2 className="font-medium">Fond et texte de l'écran</h2>
            <span className="text-xs text-neutral-500">3 maximum</span>
          </div>
          <p className="text-sm text-neutral-400 mb-3">Image ou couleur. Clique un fond pour l'afficher sur tout l'écran, clique-le encore pour l'enlever. Un écran noir (Ctrl+B) reste noir tant que tu ne le désactives pas.</p>
          <Backgrounds slots={bgs} active={bgActive} onPick={pickBg} onSet={setBgSlot} onRemove={removeBg} textColor={textColor} onText={pickText} />
          <p className="text-xs text-neutral-500 mt-3">Les fonds sont gardés sur cet appareil : fais ce réglage depuis l'ordinateur de la régie.</p>
        </section>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
