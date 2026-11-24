"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { roleLabel, roleDesc } from "@/lib/roles";
import { useT, applyLocaleAfterLogin } from "@/lib/i18n/client";
import LangSwitch from "../LangSwitch";

const input = "w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none focus:border-amber-400";

function Join() {
  const t = useT();
  const code = useSearchParams().get("code") || "";
  const [info, setInfo] = useState(undefined);        // undefined = chargement, null = lien invalide
  const [logged, setLogged] = useState(false);
  const [f, setF] = useState({ first: "", last: "", email: "", password: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));

  useEffect(() => {
    const db = createClient();
    db.rpc("invite_info", { c_code: code }).then(({ data }) => setInfo(data?.[0] || null));
    db.auth.getUser().then(({ data }) => setLogged(!!data.user));
  }, [code]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    const db = createClient();
    if (!logged) {
      const { data, error } = await db.auth.signUp({ email: f.email, password: f.password });
      if (error) { setBusy(false); return setMsg(error.message); }
      if (!data.session) { setBusy(false); return setMsg(t("join.confirmEmail")); }
    }
    const { error } = await db.rpc("join_church", { c_code: code, first: f.first.trim(), last: f.last.trim() });
    if (error) { setBusy(false); return setMsg(error.message); }
    await applyLocaleAfterLogin(db);
    location.assign("/control");
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6">
      <LangSwitch className="absolute top-4 right-4" />
      <a href="/" className="flex items-center gap-3 mb-8">
        <img src="/logo-96.png" alt="" className="h-12 w-12" />
        <span className="text-3xl font-semibold">Hosanna <span className="text-amber-400">Cast</span></span>
      </a>

      {info === undefined && <p className="text-neutral-400">{t("common.loading")}</p>}
      {info === null && <p className="text-amber-300 text-center">{t("join.invalid")}<br /><span className="text-neutral-400 text-sm">{t("join.invalidHint")}</span></p>}

      {info && (
        <form onSubmit={submit} className="w-full max-w-sm space-y-3">
          <h1 className="text-lg font-medium">{t("join.title", { church: info.church_name })}</h1>
          <p className="text-sm text-neutral-400">{t("join.profile")} <span className="text-amber-300">{roleLabel(t, info.role)}</span> · {roleDesc(t, info.role)}</p>
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder={t("join.first")} value={f.first} onChange={set("first")} className={input} />
            <input required placeholder={t("join.last")} value={f.last} onChange={set("last")} className={input} />
          </div>
          {!logged && (
            <>
              <input required type="email" placeholder={t("login.email")} value={f.email} onChange={set("email")} className={input} />
              <input required type="password" minLength={6} placeholder={t("login.password")} value={f.password} onChange={set("password")} className={input} />
            </>
          )}
          {msg && <p className="text-sm text-amber-300">{msg}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-amber-400 text-black font-medium py-2 hover:bg-amber-300 disabled:opacity-50">{busy ? t("join.busy") : t("join.submit")}</button>
        </form>
      )}
    </main>
  );
}

export default function JoinPage() {
  return <Suspense fallback={null}><Join /></Suspense>;
}
