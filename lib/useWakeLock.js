"use client";
import { useEffect, useState } from "react";

// Empêche la mise en veille de l'appareil (écran de projection, tablette de chaire).
// Le verrou est perdu quand l'onglet est caché (changement d'onglet, écran verrouillé) : on le reprend au retour.
// Navigateurs sans Wake Lock (Firefox, vieux Safari) : rien ne se passe, l'état reste « unsupported ».
// Renvoie « on » | « off » | « unsupported ».
export function useWakeLock(enabled = true) {
  const [state, setState] = useState("off");

  useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator)) { setState("unsupported"); return; }
    let lock = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible" || lock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (stopped) { lock.release().catch(() => {}); lock = null; return; }
        setState("on");
        lock.addEventListener("release", () => { lock = null; if (!stopped) setState("off"); });
      } catch { setState("off"); }          // refusé (économie d'énergie, batterie faible) : on réessaiera au prochain retour sur l'onglet
    };
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    // certains navigateurs exigent un geste de l'utilisateur : le premier clic ou la première touche réessaie
    const onGesture = () => acquire();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      lock?.release().catch(() => {});
    };
  }, [enabled]);

  return state;
}
