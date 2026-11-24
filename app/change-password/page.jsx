"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import LangSwitch from "../LangSwitch";

const input = "w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none focus:border-amber-400";

export default function ChangePassword() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [forced, setForced] = useState(false);       // première connexion : le changement est obligatoire
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || "");
      setForced(!!data?.user?.app_metadata?.must_change_password);
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (pw !== confirm) return setMsg(t("pwd.mismatch"));
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || t("pwd.fail"));
      // nouvelle session avec le nouveau mot de passe
      const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
      if (error) { location.assign("/login"); return; }
      location.assign("/");
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  };

  const logout = async () => { await createClient().auth.signOut(); location.href = "/login"; };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
      <LangSwitch className="absolute top-4 right-4" />
      <div className="flex items-center gap-3 mb-8">
        <img src="/logo-96.png" alt="" className="h-12 w-12" />
        <span className="text-3xl font-semibold">Hosanna <span className="text-amber-400">Cast</span></span>
      </div>
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-lg font-medium">{forced ? t("pwd.titleForced") : t("pwd.title")}</h1>
        {forced && <p className="text-sm text-neutral-400">{t("pwd.forcedDesc")}</p>}
        <input type="password" required minLength={8} autoFocus placeholder={t("pwd.new")} value={pw} onChange={(e) => setPw(e.target.value)} className={input} />
        <input type="password" required minLength={8} placeholder={t("pwd.confirm")} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-amber-400 text-black font-medium py-2 hover:bg-amber-300 disabled:opacity-50 transition duration-100 active:scale-95">
          {busy ? t("common.saving") : t("common.save")}
        </button>
        {forced
          ? <button type="button" onClick={logout} className="w-full text-sm text-neutral-400 hover:text-white">{t("pwd.logoutLink")}</button>
          : <a href="/" className="block text-center text-sm text-neutral-400 hover:text-white">{t("common.cancel")}</a>}
      </form>
    </main>
  );
}
