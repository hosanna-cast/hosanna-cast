"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import LangSwitch from "../LangSwitch";

export default function Onboarding() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await createClient().rpc("create_church", { church_name: name });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.push("/control"); router.refresh();
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
      <LangSwitch className="absolute top-4 right-4" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">{t("onb.title")}</h1>
        <p className="text-sm text-neutral-400">{t("onb.desc")}</p>
        <input required minLength={2} placeholder={t("onb.placeholder")} value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none focus:border-amber-400" />
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-amber-400 text-black font-medium py-2 hover:bg-amber-300 disabled:opacity-50">{busy ? "…" : t("onb.next")}</button>
      </form>
    </main>
  );
}
