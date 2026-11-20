"use client";
import { createClient } from "./supabase/client";
import { uuid } from "./uuid";
import { SCREEN_ROLES, TRACKED, UP_TYPES } from "./screenProtocol";

// Canal vers l'écran de projection d'une église (voir lib/screenProtocol.js pour le protocole).
// - Internet (Supabase Realtime) : l'écran peut être sur un autre appareil.
// - BroadcastChannel : même navigateur, instantané, et marche même si internet saute.
//
// Sécurité : avec NEXT_PUBLIC_SCREEN_PRIVATE=1, les canaux sont PRIVÉS (autorisation Realtime, voir
// supabase/realtime-security.sql) : deux sujets, « screen:<jeton> » (consoles → écrans, écriture réservée aux membres
// connectés de l'église) et « screen-up:<jeton> » (écrans → consoles, le jeton suffit). Sans la variable : un seul canal
// public, comme avant (migration sans risque).
const PRIVATE = process.env.NEXT_PUBLIC_SCREEN_PRIVATE === "1";
const ACK_WAIT = 1800;   // ms d'attente de la confirmation de l'écran
const ACK_TRIES = 2;     // renvois de l'état complet avant de prévenir l'opérateur

// openScreen(token, onMessage, options)
//  role      : « console » (défaut) | « display » | « speaker »
//  me        : { id, name, device, role } annoncé aux autres (présence) et joint à chaque message (champ « by »)
//  onPeers   : (liste) autres opérateurs connectés (consoles)
//  onScreens : (liste) écrans (role « display ») connectés
//  onReady   : appelé quand la connexion internet est prête (et après chaque reconnexion)
//  onStatus  : « online » | « connecting » | « offline »
//  onConfirm : (true|false) l'écran a confirmé / n'a pas confirmé les derniers messages
//  onResync  : la console doit renvoyer l'état complet (snapshot) : l'écran n'a pas confirmé à temps
export function openScreen(token, onMessage, { me, role = "console", onPeers, onScreens, onReady, onStatus, onConfirm, onResync } = {}) {
  const isScreen = SCREEN_ROLES.includes(role);
  const sid = uuid();
  const seen = new Set();
  const lastSeq = new Map();
  let seqOut = 0;
  let closed = false;

  // --- confirmations (consoles uniquement) ---------------------------------------------------
  const awaiting = new Map();   // mid → heure d'envoi
  let timer = null, tries = 0, confirmed = null;
  const setConfirmed = (ok) => { if (confirmed !== ok) { confirmed = ok; onConfirm?.(ok); } };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (closed || !awaiting.size) return;
      if (tries < ACK_TRIES) { tries++; onResync?.(); arm(); }
      else { awaiting.clear(); tries = 0; setConfirmed(false); }
    }, ACK_WAIT);
  };
  const track = (m) => {
    if (!m.resync) tries = 0;
    awaiting.set(m.mid, Date.now());
    arm();
  };

  // --- réception -----------------------------------------------------------------------------
  // from : « down » (canal consoles → écrans), « up » (écrans → consoles), « local » (même navigateur)
  const receive = (m, from) => {
    if (!m || typeof m !== "object" || !m.mid || seen.has(m.mid)) return;
    if (from === "up" && !(role === "console" && UP_TYPES.has(m.type))) return;   // un écran ne pilote jamais
    seen.add(m.mid);
    if (seen.size > 300) seen.delete(seen.values().next().value);
    if (m.sid && Number.isFinite(m.seq)) {
      if (m.seq <= (lastSeq.get(m.sid) ?? 0)) return;                              // plus ancien que le dernier message de cet émetteur
      lastSeq.set(m.sid, m.seq);
      if (lastSeq.size > 100) lastSeq.delete(lastSeq.keys().next().value);
    }
    if (m.type === "ack") {
      if (role !== "console") return;
      const t = awaiting.get(m.ref);
      if (t !== undefined) for (const [k, v] of awaiting) if (v <= t) awaiting.delete(k);   // l'écran a reçu celui-ci : donc aussi les précédents
      if (!awaiting.size) { clearTimeout(timer); tries = 0; setConfirmed(true); }
      return;
    }
    onMessage?.(m);
  };

  // BroadcastChannel absent sur certains anciens téléphones : on passe alors uniquement par internet
  const local = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`verset:${token || "local"}`) : null;
  if (local) local.onmessage = (e) => receive(e.data, "local");

  // --- internet (Supabase Realtime) ----------------------------------------------------------
  const client = token ? createClient() : null;
  let down = null, up = null;
  const statuses = { down: "idle", up: "idle" };
  const flat = (c) => Object.values(c.presenceState()).flat();
  const emitStatus = () => {
    if (!onStatus) return;
    const list = down === up ? [statuses.down] : [statuses.down, statuses.up];
    onStatus(list.every((s) => s === "SUBSCRIBED") ? "online" : list.some((s) => ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s)) ? "offline" : "connecting");
  };
  const emitPeers = () => down && onPeers?.(flat(down).filter((p) => !SCREEN_ROLES.includes(p.role)));
  const emitScreens = () => up && onScreens?.(flat(up).filter((p) => p.role === "display"));

  const start = async () => {
    if (!client) return;
    if (PRIVATE) {
      // le canal privé doit connaître l'utilisateur connecté avant de s'abonner (l'écran, lui, reste anonyme)
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.access_token) client.realtime.setAuth(session.access_token);
      } catch {}
    }
    if (closed) return;

    const cfg = (withPresence) => ({ config: { broadcast: { self: false }, ...(PRIVATE ? { private: true } : {}), ...(withPresence && me ? { presence: { key: me.id } } : {}) } });
    down = client.channel(`screen:${token}`, cfg(PRIVATE ? !isScreen : true));
    up = PRIVATE ? client.channel(`screen-up:${token}`, cfg(isScreen)) : down;

    down.on("broadcast", { event: "msg" }, ({ payload }) => receive(payload, "down"));
    if (up !== down && role === "console") up.on("broadcast", { event: "msg" }, ({ payload }) => receive(payload, "up"));
    if (role === "console") {
      if (me && onPeers) down.on("presence", { event: "sync" }, emitPeers);
      if (onScreens) up.on("presence", { event: "sync" }, emitScreens);
    }

    const subscribe = (chan, key, track_) => chan.subscribe((status) => {
      statuses[key] = status;
      emitStatus();
      if (status !== "SUBSCRIBED") return;
      if (track_ && me) chan.track(me);
      if (down === up || (statuses.down === "SUBSCRIBED" && statuses.up === "SUBSCRIBED")) onReady?.();
    });
    subscribe(down, "down", PRIVATE ? !isScreen : true);
    if (up !== down) subscribe(up, "up", isScreen);
  };
  start();

  return {
    postMessage(msg) {
      const m = { ...msg, mid: uuid(), sid, seq: ++seqOut, ...(me ? { by: me } : {}) };
      local?.postMessage(m);
      // les consoles parlent sur « down », les écrans sur « up »
      const chan = isScreen ? up : down;
      if (chan) Promise.resolve(chan.send({ type: "broadcast", event: "msg", payload: m })).catch(() => {});
      if (role === "console" && TRACKED.has(m.type)) track(m);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      local?.close();
      [...new Set([down, up].filter(Boolean))].forEach((c) => client?.removeChannel(c));
    },
  };
}
