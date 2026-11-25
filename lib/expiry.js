import { makeT, intlLocale } from "./i18n/index";

// Les fonctions qui produisent du texte prennent la langue (« fr » | « en », voir useLocale()) en dernier argument.

// « il reste 2 j 5 h » avant l'effacement automatique (3 jours après la création)
export const timeLeft = (iso, loc) => {
  const t = makeT(loc);
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t("ex.expired");
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return t("ex.dh", { d: Math.floor(h / 24), h: h % 24 });
  return h >= 1 ? t("ex.h", { h }) : t("ex.lessThan1h");
};
export const expiryDate = (iso, loc) =>
  new Date(iso).toLocaleString(intlLocale(loc), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
export const isExpired = (iso) => new Date(iso).getTime() <= Date.now();

// Jours de la semaine (0 = dimanche, comme Date.getDay())
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const dayShort = (d, loc) => makeT(loc)(`day.short.${d}`);
export const daysText = (days, loc) => {
  const t = makeT(loc);
  const d = [...(days || [])].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (!d.length) return t("ex.kept");
  if (d.length === 7) return t("ex.everyDay");
  return t("ex.every", { days: d.map((x) => t(`day.long.${x}`)).join(", ") });
};
export const FAR_FUTURE = () => new Date(Date.now() + 100 * 365 * 86400000).toISOString();   // « ne s'efface jamais »
export const IN_3_DAYS = () => new Date(Date.now() + 3 * 86400000).toISOString();

// --- Annonces récurrentes avec date de fin facultative -------------------------------------
// Pas de colonne en plus dans la base : pour une annonce récurrente, expires_at = fin du dernier jour
// (ex. 30 novembre à 23 h 59), ou FAR_FUTURE (an 2126) quand il n'y a pas de date de fin.
const pad = (n) => String(n).padStart(2, "0");
export const toInputDate = (d) => {                                   // Date ou ISO -> "2026-11-30" (heure locale)
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const todayInput = () => toInputDate(new Date());
export const endOfDay = (ymd) => {                                    // "2026-11-30" -> fin de ce jour-là (heure locale)
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
};
export const keepExpiry = (until) => (until ? endOfDay(until) : FAR_FUTURE());
export const hasEnd = (a) => !!a.keep && new Date(a.expires_at).getFullYear() < 2100;
export const endText = (iso, loc) => makeT(loc)("ex.until", { date: new Date(iso).toLocaleDateString(intlLocale(loc), { day: "numeric", month: "long" }) });
export const recurText = (a, loc) => daysText(a.days, loc) + (hasEnd(a) ? ` · ${endText(a.expires_at, loc)}` : "");
// annonce récurrente prévue aujourd'hui
export const runsToday = (a) => !!a.keep && (a.days || []).includes(new Date().getDay());

// --- Les trois types d'annonces (aucune colonne en plus dans la base) --------------------------
//  regular : Régulière     = keep, sans date de fin  -> ne disparaît jamais
//  special : Temps spécial = keep, avec date d'événement -> disparaît après cette date
//  oneoff  : Ponctuelle    = pas keep -> disparaît 3 jours après l'ajout
export const typesOf = (loc) => {
  const t = makeT(loc);
  const one = (id) => ({ label: t(`type.${id}`), short: t(`type.${id}.short`), hint: t(`type.${id}.hint`) });
  return { regular: one("regular"), special: one("special"), oneoff: one("oneoff") };
};
export const TYPE_IDS = ["regular", "special", "oneoff"];
export const typeOf = (a) => (!a.keep ? "oneoff" : hasEnd(a) ? "special" : "regular");
// réglage envoyé à la base : { type, days, until } -> { keep, days, until }
export const optsOf = ({ type, days, until }) => ({
  keep: type !== "oneoff",
  days: type === "oneoff" ? [] : days || [],
  until: type === "special" ? until : "",
});
export const specialText = (a, loc) => `${a.days?.length ? daysText(a.days, loc) + " · " : ""}${endText(a.expires_at, loc)}`;
