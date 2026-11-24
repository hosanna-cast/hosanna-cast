"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { COOKIE, makeT, normalizeLocale } from "./index";
import { createClient } from "../supabase/client";

const Ctx = createContext({ locale: "fr", t: makeT("fr") });

export function I18nProvider({ locale, children }) {
  const loc = normalizeLocale(locale);
  const value = useMemo(() => ({ locale: loc, t: makeT(loc) }), [loc]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLocale = () => useContext(Ctx).locale;

export const writeLocaleCookie = (l) => { document.cookie = `${COOKIE}=${normalizeLocale(l)}; path=/; max-age=31536000; samesite=lax`; };

// Change la langue : cookie (immédiat, valable aussi avant la connexion) + préférence enregistrée sur le profil si la personne est connectée
export function useSetLocale() {
  const router = useRouter();
  return useCallback(async (l) => {
    const loc = normalizeLocale(l);
    writeLocaleCookie(loc);
    router.refresh();
    try { await createClient().rpc("set_my_locale", { loc }); } catch {}     // sans connexion ou sans la mise à jour SQL : le cookie suffit
  }, [router]);
}

const readCookie = () => document.cookie.split("; ").find((c) => c.startsWith(COOKIE + "="))?.split("=")[1] || null;

// Juste après la connexion :
//  - si la personne a choisi une langue sur la page de connexion, ce choix gagne (et est enregistré sur son profil) ;
//  - sinon on prend la langue de son profil, puis la langue par défaut de l'église, puis celle du navigateur.
export async function applyLocaleAfterLogin(db) {
  const chosen = readCookie();
  if (chosen) { try { await db.rpc("set_my_locale", { loc: normalizeLocale(chosen) }); } catch {} return; }
  try {
    const { data: { user } } = await db.auth.getUser();
    const { data: p } = await db.from("profiles").select("locale").eq("user_id", user.id).maybeSingle();
    let loc = p?.locale;
    if (!loc) { const { data: c } = await db.from("church_settings").select("default_locale").maybeSingle(); loc = c?.default_locale; }
    if (loc) writeLocaleCookie(loc);
  } catch {}
}
