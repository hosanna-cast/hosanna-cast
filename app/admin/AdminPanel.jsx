"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, ROLE_IDS } from "@/lib/roles";

const card = "rounded-xl bg-neutral-800/60 border border-neutral-700 p-4";
const field = "rounded-lg bg-neutral-900 border border-neutral-600 px-3 py-2 text-sm outline-none focus:border-amber-400 w-full";
const select = "rounded-lg bg-neutral-800 border border-neutral-600 px-2 py-1.5 text-sm outline-none focus:border-amber-400";

export default function AdminPanel({ churchName }) {
  const [members, setMembers] = useState(null);
  const [msg, setMsg] = useState(null);
  const db = () => createClient();

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
      setMade({ email: form.email, password: form.password });
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

  const run = async (p) => { setMsg(null); const { error } = await p; if (error) setMsg(error.message); await load(); };
  const changeRole = (id, r) => run(db().rpc("set_member_role", { target: id, new_role: r }));
  const remove = (u) => confirm(`Retirer ${u.first_name || u.email} de l'équipe ?`) && run(db().rpc("remove_member", { target: u.user_id }));

  return (
    <main className="min-h-screen bg-neutral-900 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Administration</h1>
            <p className="text-sm text-neutral-400">{churchName}</p>
          </div>
          <a href="/control" className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5">← Console</a>
        </header>

        {msg && <p className="text-sm text-amber-300 bg-amber-400/10 rounded-lg px-3 py-2">{msg}</p>}

        <section className={card}>
          <h2 className="font-medium mb-1">Les profils</h2>
          <ul className="text-sm text-neutral-400 space-y-1">
            {ROLE_IDS.map((r) => <li key={r}><b className="text-neutral-200 font-medium">{ROLES[r].label}</b> : {ROLES[r].desc}</li>)}
          </ul>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium">Équipe</h2>
            {!form && <button onClick={() => { setMade(null); setForm({ ...EMPTY }); }} className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5 active:scale-95 transition duration-100">+ Créer un profil</button>}
          </div>

          {made && (
            <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/40 p-3 text-sm">
              <p className="text-green-300 font-medium mb-1">Profil créé ✓</p>
              <p className="text-neutral-300">Email : <b className="font-medium">{made.email}</b><br />Mot de passe provisoire : <b className="font-mono">{made.password}</b></p>
              <button onClick={() => navigator.clipboard?.writeText(`Email : ${made.email}\nMot de passe : ${made.password}\n${location.origin}/login`)} className="mt-2 text-amber-400 hover:underline">Copier les identifiants</button>
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
              {members.map((u) => (
                <li key={u.user_id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-sm truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} {u.is_me && <span className="text-xs text-amber-300">(vous)</span>}</div>
                    <div className="text-xs text-neutral-500 truncate">{u.email}</div>
                  </div>
                  <select value={u.role} onChange={(e) => changeRole(u.user_id, e.target.value)} className={select}>
                    {ROLE_IDS.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                  </select>
                  <button onClick={() => remove(u)} disabled={u.is_me} className="text-sm text-neutral-400 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none">Retirer</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
