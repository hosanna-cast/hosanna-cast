"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const input = "w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none focus:border-amber-400";
const EMPTY = { church: "", city: "", country: "", first: "", last: "", email: "", password: "", confirm: "" };

export default function Login() {
  const [mode, setMode] = useState("in");          // "in" | "up"
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const up = mode === "up";

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (up && f.password !== f.confirm) return setMsg("Les deux mots de passe sont différents.");
    setBusy(true);
    const supabase = createClient();

    if (!up) {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) { setBusy(false); return setMsg(error.message); }
      location.assign("/control");          // on reste en « connexion en cours » jusqu'au chargement de la console
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password });
    if (error) { setBusy(false); return setMsg(error.message); }
    if (!data.session) {                           // la confirmation par email est encore activée dans Supabase
      setBusy(false);
      return setMsg("Compte créé. Confirmez votre email avant de vous connecter.");
    }
    const { error: e2 } = await supabase.rpc("create_church", {
      church_name: f.church.trim() || `Église de ${f.city.trim()}`,
      church_city: f.city.trim(),
      church_country: f.country.trim(),
      first: f.first.trim(),
      last: f.last.trim(),
    });
    if (e2) { setBusy(false); return setMsg(e2.message); }
    location.assign("/control");
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
      <a href="/" className="flex items-center gap-3 mb-8">
        <img src="/logo.png" alt="" className="h-12 w-12" />
        <span className="text-3xl font-semibold">Hosanna <span className="text-amber-400">Cast</span></span>
      </a>
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-lg font-medium">{up ? "Inscrire votre église" : "Connexion"}</h1>
        {up && (
          <>
            <input placeholder="Église" value={f.church} onChange={set("church")} className={input} />
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Ville *" value={f.city} onChange={set("city")} className={input} />
              <input required placeholder="Pays *" value={f.country} onChange={set("country")} className={input} />
              <input required placeholder="Prénom *" value={f.first} onChange={set("first")} className={input} />
              <input required placeholder="Nom *" value={f.last} onChange={set("last")} className={input} />
            </div>
          </>
        )}
        <input type="email" required placeholder={up ? "Email *" : "Email"} value={f.email} onChange={set("email")} className={input} />
        <input type="password" required minLength={8} placeholder={up ? "Mot de passe * (8 caractères min.)" : "Mot de passe"} value={f.password} onChange={set("password")} className={input} />
        {up && <input type="password" required minLength={8} placeholder="Confirmer le mot de passe *" value={f.confirm} onChange={set("confirm")} className={input} />}
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-amber-400 text-black font-medium py-2 hover:bg-amber-300 disabled:opacity-50 transition duration-100 active:scale-95">
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              {up ? "Création du compte…" : "Connexion en cours…"}
            </span>
          ) : up ? "Créer mon compte" : "Se connecter"}
        </button>
        <button type="button" onClick={() => { setMode(up ? "in" : "up"); setMsg(null); }} className="w-full text-sm text-neutral-400 hover:text-white">
          {up ? "J'ai déjà un compte" : "Pas encore de compte ? Inscrire mon église"}
        </button>
      </form>
    </main>
  );
}
