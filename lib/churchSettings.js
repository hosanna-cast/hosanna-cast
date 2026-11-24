"use client";
import { createClient } from "./supabase/client";
import { mergeSettings, loadSettings, loadLogo, saveSettings, saveLogo } from "./displaySettings";

// Réglages de l'écran PARTAGÉS par toute l'église (table church_settings) :
//   display : bandeau, plein écran, logo, transition (voir displaySettings.js)
//   bgs     : { slots, active, textColor, applied: { bg, text } }  (fonds préparés + ce qui est vraiment sur l'écran)
//   logo    : image PNG (data:)
//   default_locale : langue proposée aux membres qui n'en ont pas choisi
// Lecture : tous les membres. Écriture : administrateurs (règles côté base : supabase/church-settings.sql).

const COLS = "display, bgs, logo, default_locale";
const DEFAULT_TEXT = "#ffffff";

// ce qui est réellement sur l'écran, avec l'ancien format (sans « applied ») : le fond actif était déjà sur l'écran
export function appliedOf(bgs) {
  const slots = Array.isArray(bgs?.slots) ? bgs.slots : [];
  const draft = slots[bgs?.active] || null;
  return bgs?.applied
    ? { bg: bgs.applied.bg || null, text: bgs.applied.text || bgs.textColor || DEFAULT_TEXT }
    : { bg: draft, text: bgs?.textColor || DEFAULT_TEXT };
}

export async function fetchChurchSettings(churchId) {
  const { data, error } = await createClient().from("church_settings").select(COLS).eq("church_id", churchId).maybeSingle();
  return { data: data || null, error };
}

// enregistre une ou plusieurs colonnes (les autres ne sont pas touchées)
let lastOwnSave = 0;          // nos propres enregistrements déclenchent aussi un événement : on les ignore (sinon un curseur en cours « saute » en arrière)
export async function saveChurchSettings(churchId, patch) {
  lastOwnSave = Date.now();
  const { error } = await createClient().from("church_settings")
    .upsert({ church_id: churchId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "church_id" });
  return error;
}

// Enregistrement différé (curseurs : un seul envoi quand la main s'arrête)
const timers = {};
export function saveChurchSettingsSoon(churchId, patch, ms = 600) {
  const key = Object.keys(patch).join(",");
  clearTimeout(timers[key]);
  lastOwnSave = Date.now() + ms;
  timers[key] = setTimeout(() => saveChurchSettings(churchId, patch), ms);
}

// Reprise de l'ancien stockage (navigateur de la régie) vers l'église : une seule fois, par un administrateur
export async function migrateLegacy(churchId) {
  try {
    const raw = JSON.parse(localStorage.getItem("hc.bgs." + churchId) || "null");
    const display = loadSettings();
    const logo = loadLogo();
    if (!raw && !logo && JSON.stringify(display) === JSON.stringify(mergeSettings(null))) return null;
    const patch = { display, bgs: raw || {}, logo: logo || null };
    const error = await saveChurchSettings(churchId, patch);
    return error ? null : patch;
  } catch { return null; }
}

// Écoute des changements faits par un autre appareil de l'église (rafale d'événements = un seul rechargement)
export function watchChurchSettings(churchId, onChange) {
  const db = createClient();
  let timer;
  const ch = db.channel("cs:" + churchId)
    .on("postgres_changes", { event: "*", schema: "public", table: "church_settings", filter: `church_id=eq.${churchId}` },
      () => { if (Date.now() - lastOwnSave < 3000) return; clearTimeout(timer); timer = setTimeout(onChange, 400); })
    .subscribe();
  return () => { clearTimeout(timer); db.removeChannel(ch); };
}

// garde une copie locale (affichage instantané au prochain démarrage, écran hors connexion)
export function cacheLocally({ display, logo }) {
  if (display) saveSettings(mergeSettings(display));
  saveLogo(logo || null);
}
