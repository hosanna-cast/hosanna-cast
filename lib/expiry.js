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
