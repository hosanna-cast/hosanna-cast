// Réglages de l'écran de projection : bandeau et plein écran.
// Gardés dans le navigateur (localStorage), envoyés à l'écran par la console (message « settings » / « logo »).

export const DEFAULT_SETTINGS = {
  band: {
    height: 20,          // hauteur du bandeau, en % de la hauteur de l'écran
    logoOn: true,
    logoSide: "right",   // « left » | « right »
    logoSize: 16,        // hauteur du logo, en % de la hauteur de l'écran
    logoRise: 5,         // de combien le logo dépasse au-dessus du bandeau (% de l'écran, négatif = plus bas)
    pageChars: 200,      // longueur maximale d'une page de passage biblique (caractères) : au-delà, le passage est découpé en pages
  },
  full: {
    padX: 6,             // marges gauche / droite (% de la largeur)
    padTop: 4,           // marge du haut (% de la hauteur)
    padBottom: 4,        // marge du bas (% de la hauteur)
    maxFont: 90,         // taille maximale du texte (px, pour un écran de 1080 px de haut)
    valign: "center",    // « top » | « center » | « bottom »
    logoOn: false,
    logoSize: 10,        // hauteur du logo, en % de la hauteur de l'écran
    pageChars: 420,      // longueur maximale d'une page de passage biblique (caractères)
  },
  top: {
    side: "right",       // logo posé en haut de l'écran (hors bandeau / plein écran) : « left » | « right »
    size: 100,           // taille du logo en % de sa taille maximale (250 px)
  },
  fade: 250,             // durée de la transition douce quand le texte change (ms, 0 = aucune)
};

// bornes de chaque curseur : [min, max]
export const LIMITS = {
  band: { height: [8, 45], logoSize: [5, 40], logoRise: [-10, 25], pageChars: [60, 600] },
  full: { padX: [0, 20], padTop: [0, 25], padBottom: [0, 25], maxFont: [30, 160], logoSize: [4, 30], pageChars: [150, 1200] },
  top: { size: [20, 100] },
  fade: [0, 800],
};

const clamp = (n, [lo, hi], d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : d);

// complète / corrige des réglages venant du disque ou du réseau : jamais de valeur absente ou hors limites
export function mergeSettings(raw) {
  const out = { band: { ...DEFAULT_SETTINGS.band }, full: { ...DEFAULT_SETTINGS.full }, top: { ...DEFAULT_SETTINGS.top }, fade: clamp(raw?.fade, LIMITS.fade, DEFAULT_SETTINGS.fade) };
  for (const mode of ["band", "full"]) {
    const src = raw && typeof raw === "object" ? raw[mode] : null;
    if (!src || typeof src !== "object") continue;
    for (const k of Object.keys(LIMITS[mode])) out[mode][k] = clamp(src[k], LIMITS[mode][k], DEFAULT_SETTINGS[mode][k]);
    if (typeof src.logoOn === "boolean") out[mode].logoOn = src.logoOn;
  }
  out.top.size = clamp(raw?.top?.size, LIMITS.top.size, DEFAULT_SETTINGS.top.size);
  if (raw?.top?.side === "left" || raw?.top?.side === "right") out.top.side = raw.top.side;
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

// Logo : PNG uniquement, 250 x 250 px maximum (transparence et proportions conservées).
// Le message envoyé à l'écran par internet (Supabase Realtime) est limité (~250 Ko) : si le PNG est trop lourd,
// on le réduit encore (toujours dans la limite des 250 px) jusqu'à passer sous ~180 Ko.
export const LOGO_MAX = 250;
export const LOGO_BYTES = 180_000;
export function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    if (file.type !== "image/png") { reject(new Error("png")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let out = "";
        for (const max of [LOGO_MAX, 200, 160, 128, 96]) {
          const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL("image/png");
          if (out.length < LOGO_BYTES) break;
        }
        resolve(out);
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}
