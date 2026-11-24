import { cookies, headers } from "next/headers";
import { COOKIE, guessLocale, makeT, normalizeLocale, LOCALE_IDS } from "./index";

// Langue choisie : cookie (choix de la personne) → langue du navigateur → français
export async function getLocale() {
  const c = (await cookies()).get(COOKIE)?.value;
  if (LOCALE_IDS.includes(c)) return normalizeLocale(c);
  return guessLocale((await headers()).get("accept-language"));
}

export async function getT() {
  return makeT(await getLocale());
}
