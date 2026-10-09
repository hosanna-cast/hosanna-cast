"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, ROLE_IDS } from "@/lib/roles";

const card = "rounded-xl bg-neutral-800/60 border border-neutral-700 p-4";
const select = "rounded-lg bg-neutral-800 border border-neutral-600 px-2 py-1.5 text-sm outline-none focus:border-amber-400";

export default function AdminPanel({ churchName }) {
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [role, setRole] = useState("assistant");     // rôle du prochain lien d'invitation
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(null);
  const db = () => createClient();

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([db().rpc("list_members"), db().rpc("list_invites")]);
    if (m.error) setMsg(m.error.message); else setMembers(m.data);
    if (!i.error) setInvites(i.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (p) => { setMsg(null); const { error } = await p; if (error) setMsg(error.message); await load(); };
  const changeRole = (id, r) => run(db().rpc("set_member_role", { target: id, new_role: r }));
  const remove = (u) => confirm(`Retirer ${u.first_name || u.email} de l'équipe ?`) && run(db().rpc("remove_member", { target: u.user_id }));
  const invite = () => run(db().rpc("create_invite", { new_role: role }));
  const revoke = (code) => run(db().rpc("revoke_invite", { c_code: code }));
  const link = (code) => `${location.origin}/join?code=${code}`;
  const copy = (code) => navigator.clipboard?.writeText(link(code)).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); });

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
          <h2 className="font-medium mb-3">Équipe</h2>
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

        <section className={card}>
          <h2 className="font-medium mb-1">Inviter quelqu'un</h2>
          <p className="text-sm text-neutral-400 mb-3">Choisissez son profil, créez le lien et envoyez-le-lui. Le lien sert une seule fois et expire au bout de 7 jours.</p>
          <div className="flex flex-wrap gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={select}>
              {ROLE_IDS.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </select>
            <button onClick={invite} className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-medium text-sm px-3.5 py-1.5 active:scale-95 transition duration-100">Créer le lien</button>
          </div>

          {invites.length > 0 && (
            <ul className="mt-4 space-y-2">
              {invites.map((i) => (
                <li key={i.code} className="flex flex-wrap items-center gap-2 text-sm rounded-lg bg-neutral-800 px-3 py-2">
                  <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-amber-300">{ROLES[i.role]?.label}</span>
                  <span className="flex-1 basis-40 min-w-0 truncate text-neutral-400 text-xs">{`…/join?code=${i.code}`}</span>
                  <button onClick={() => copy(i.code)} className="text-amber-400 hover:underline">{copied === i.code ? "Copié ✓" : "Copier le lien"}</button>
                  <button onClick={() => revoke(i.code)} className="text-neutral-400 hover:text-red-400">Annuler</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
