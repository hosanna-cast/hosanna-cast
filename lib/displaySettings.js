// Réglages de l'écran de projection : bandeau et plein écran.
// Gardés dans le navigateur (localStorage), envoyés à l'écran par la console (message « settings » / « logo »).

export const DEFAULT_SETTINGS = {
  band: {
    height: 20,          // hauteur du bandeau, en % de la hauteur de l'écran
    logoOn: true,
    logoSide: "right",   // « left » | « right »
    logoSize: 16,        // hauteur du logo, en % de la hauteur de l'écran
    logoRise: 5,         // de combien le logo dépasse au-dessus du bandeau (% de l'écran, négatif = plus bas)
  },
  full: {
    padX: 6,             // marges gauche / droite (% de la largeur)
    padTop: 4,           // marge du haut (% de la hauteur)
    padBottom: 4,        // marge du bas (% de la hauteur)
    maxFont: 90,         // taille maximale du texte (px, pour un écran de 1080 px de haut)
    valign: "center",    // « top » | « center » | « bottom »
    logoOn: false,
    logoSize: 10,        // hauteur du logo, en % de la hauteur de l'écran
  },
};

// bornes de chaque curseur : [min, max]
export const LIMITS = {
  band: { height: [8, 45], logoSize: [5, 40], logoRise: [-10, 25] },
  full: { padX: [0, 20], padTop: [0, 25], padBottom: [0, 25], maxFont: [30, 160], logoSize: [4, 30] },
};

const clamp = (n, [lo, hi], d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : d);

// complète / corrige des réglages venant du disque ou du réseau : jamais de valeur absente ou hors limites
export function mergeSettings(raw) {
  const out = { band: { ...DEFAULT_SETTINGS.band }, full: { ...DEFAULT_SETTINGS.full } };
  for (const mode of ["band", "full"]) {
    const src = raw && typeof raw === "object" ? raw[mode] : null;
    if (!src || typeof src !== "object") continue;
    for (const k of Object.keys(LIMITS[mode])) out[mode][k] = clamp(src[k], LIMITS[mode][k], DEFAULT_SETTINGS[mode][k]);
    if (typeof src.logoOn === "boolean") out[mode].logoOn = src.logoOn;
  }
  const b = raw?.band?.logoSide; if (b === "left" || b === "right") out.band.logoSide = b;
  const v = raw?.full?.valign; if (["top", "center", "bottom"].includes(v)) out.full.valign = v;
  return out;
}

const KEY = "hosanna-display-settings";
const LOGO_KEY = "hosanna-display-logo";

export function loadSettings() {
  try { return mergeSettings(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return mergeSettings(null); }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

export function loadLogo() {
  try { const l = localStorage.getItem(LOGO_KEY); return l && l.startsWith("data:image/") ? l : null; } catch { return null; }
}
export function saveLogo(l) { try { if (l) localStorage.setItem(LOGO_KEY, l); else localStorage.removeItem(LOGO_KEY); } catch {} }

// Redimensionne le logo avant de l'enregistrer (la transparence du PNG est conservée).
// On vise moins de ~180 Ko : c'est la limite prudente d'un message Supabase Realtime.
export function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let out = null;
        for (const max of [400, 300, 220, 160]) {
          const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/png");
          if (out.length < 180_000) break;
        }
        resolve(out);
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}
