// Langues de la plateforme. Une seule source de vérité : pour ajouter une langue, on l'ajoute ici et on crée son dictionnaire.
import fr from "./fr";
import en from "./en";

export const LOCALES = { fr: "Français", en: "English" };
export const LOCALE_IDS = Object.keys(LOCALES);
export const DEFAULT_LOCALE = "fr";
export const COOKIE = "hc_lang";

const DICTS = { fr, en };

export const normalizeLocale = (l) => (LOCALE_IDS.includes(l) ? l : DEFAULT_LOCALE);

// Code de langue pour Intl / toLocaleString / localeCompare
const INTL = { fr: "fr-FR", en: "en-GB" };
export const intlLocale = (l) => INTL[normalizeLocale(l)];

// Langue du navigateur (premier choix quand rien n'est encore enregistré) : « en-US » → « en »
export const guessLocale = (header) => {
  const first = String(header || "").split(",")[0]?.trim().toLowerCase().slice(0, 2);
  return LOCALE_IDS.includes(first) ? first : DEFAULT_LOCALE;
};

// t("clé", { variable }) : texte dans la langue choisie, repli sur le français, puis sur la clé elle-même
export function makeT(locale) {
  const dict = DICTS[normalizeLocale(locale)];
  return (key, vars) => {
    let s = dict[key] ?? DICTS.fr[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}
