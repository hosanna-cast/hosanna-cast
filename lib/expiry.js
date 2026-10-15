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
