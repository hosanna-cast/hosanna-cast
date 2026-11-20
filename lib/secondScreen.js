"use client";

// Ouvre l'écran de projection directement sur le 2ᵉ écran (le vidéoprojecteur), sans glisser la fenêtre à la main.
// Utilise l'API « Window Management » (Chrome, Edge, Opera sur ordinateur) : le navigateur demande UNE fois l'autorisation
// « Gérer les fenêtres sur tous vos écrans ». Ailleurs (Firefox, Safari, téléphone), on retombe sur un simple nouvel onglet.
//
// La fenêtre s'ouvre à la taille exacte du 2ᵉ écran. Un clic (ou la touche F) dans cette fenêtre la passe en plein écran :
// les navigateurs interdisent le plein écran automatique sans geste de l'utilisateur.
export const canPlaceWindows = () => typeof window !== "undefined" && "getScreenDetails" in window;

// Renvoie la fenêtre ouverte, ou null si on ne peut pas choisir d'écran (un seul écran, permission refusée…).
export async function openOnSecondScreen(url, name = "hosanna-display") {
  if (!canPlaceWindows()) return null;
  let details;
  try { details = await window.getScreenDetails(); } catch { return null; }          // permission refusée
  const others = details.screens.filter((s) => s !== details.currentScreen);
  const target = others.find((s) => !s.isPrimary) || others[0];                         // un 2ᵉ écran, de préférence non principal
  if (!target) return null;
  const features = `popup=yes,left=${target.left},top=${target.top},width=${target.width},height=${target.height}`;
  const w = window.open(url, name, features);
  w?.focus?.();
  return w;
}
