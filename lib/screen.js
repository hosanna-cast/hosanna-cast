"use client";
import { createClient } from "./supabase/client";
import { uuid } from "./uuid";

// Canal vers l'écran de projection d'une église.
// - Internet (Supabase Realtime) : l'écran peut être sur un autre appareil.
// - BroadcastChannel : même navigateur, instantané, et marche même si internet saute.
// Chaque message porte un identifiant (mid) pour ne jamais être traité deux fois.
//
// Plusieurs consoles (opérateurs) peuvent piloter le même écran :
// - « me » {id, name, device} : qui je suis. Il est joint à chaque message (champ « by »)
//   et annoncé aux autres (présence), pour que chacun voie qui est connecté et qui a agi.
// - onPeers(liste) : appelé quand quelqu'un arrive ou part.
// - onReady() : appelé quand la connexion internet est prête.
export function openScreen(token, onMessage, { me, onPeers, onReady } = {}) {
  const mid = uuid;
  const seen = new Set();
  const receive = (m) => {
    if (!m || seen.has(m.mid)) return;
    seen.add(m.mid);
    if (seen.size > 200) seen.delete(seen.values().next().value);
    onMessage?.(m);
  };

  // BroadcastChannel absent sur certains anciens téléphones : on passe alors uniquement par internet
  const local = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`verset:${token || "local"}`) : null;
  if (local) local.onmessage = (e) => receive(e.data);

  let remote = null;
  if (token) {
    remote = createClient().channel(`screen:${token}`, { config: { broadcast: { self: false }, ...(me ? { presence: { key: me.id } } : {}) } });
    remote.on("broadcast", { event: "msg" }, ({ payload }) => receive(payload));
    if (me && onPeers) remote.on("presence", { event: "sync" }, () => onPeers(Object.values(remote.presenceState()).flat()));
    remote.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (me) remote.track(me);
      onReady?.();
    });
  }

  return {
    postMessage(msg) {
      const m = { ...msg, mid: mid(), ...(me ? { by: me } : {}) };
      local?.postMessage(m);
      remote?.send({ type: "broadcast", event: "msg", payload: m });
    },
    close() { local?.close(); remote?.unsubscribe(); },
  };
}
