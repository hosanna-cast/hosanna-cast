// « il reste 2 j 5 h » avant l'effacement automatique (3 jours après la création)
export const timeLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)} j ${h % 24} h`;
  return h >= 1 ? `${h} h` : "moins d'1 h";
};
export const expiryDate = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
export const isExpired = (iso) => new Date(iso).getTime() <= Date.now();

// Jours de la semaine (0 = dimanche, comme Date.getDay())
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const daysText = (days) => {
  const d = [...(days || [])].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (!d.length) return "gardée";
  if (d.length === 7) return "tous les jours";
  return "chaque " + d.map((x) => DAY_LONG[x]).join(", ");
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
export const endText = (iso) => "jusqu'au " + new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
export const recurText = (a) => daysText(a.days) + (hasEnd(a) ? ` · ${endText(a.expires_at)}` : "");
// annonce récurrente prévue aujourd'hui
export const runsToday = (a) => !!a.keep && (a.days || []).includes(new Date().getDay());

// --- Les trois types d'annonces (aucune colonne en plus dans la base) --------------------------
//  regular : Régulière     = keep, sans date de fin  -> ne disparaît jamais
//  special : Temps spécial = keep, avec date d'événement -> disparaît après cette date
//  oneoff  : Ponctuelle    = pas keep -> disparaît 3 jours après l'ajout
export const TYPES = {
  regular: { label: "Régulière",     short: "↻ Régulières",     hint: "Revient chaque semaine (cellule, prière, culte…). Ne s'efface jamais." },
  special: { label: "Temps spécial", short: "★ Temps spéciaux", hint: "Un événement à date précise (convention, évangélisation…). S'efface après la date." },
  oneoff:  { label: "Ponctuelle",    short: "Ponctuelles",      hint: "Une info de la semaine. S'efface 3 jours après l'ajout." },
};
export const TYPE_IDS = ["regular", "special", "oneoff"];
export const typeOf = (a) => (!a.keep ? "oneoff" : hasEnd(a) ? "special" : "regular");
// réglage envoyé à la base : { type, days, until } -> { keep, days, until }
export const optsOf = ({ type, days, until }) => ({
  keep: type !== "oneoff",
  days: type === "oneoff" ? [] : days || [],
  until: type === "special" ? until : "",
});
export const specialText = (a) => `${a.days?.length ? daysText(a.days) + " · " : ""}${endText(a.expires_at)}`;
