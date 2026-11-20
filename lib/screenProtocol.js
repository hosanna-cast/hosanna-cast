// Protocole de l'écran de projection : une seule source de vérité.
//
// Deux sens de circulation :
//  - « down » (consoles → écrans)  : show, update, clear, blank, layout, bg, settings, logo, media, snapshot…
//  - « up »   (écrans → consoles)  : display?, bg?, speaker?, ack, mediaStatus
//
// Principes (Phase 1) :
//  1. L'écran ne garde AUCUN état important : à l'ouverture, après une coupure, ou si la console n'a pas reçu
//     de confirmation, il reçoit un « snapshot » = l'état complet (verset, noir, mise en page, fond, réglages).
//  2. Chaque message d'état envoyé par une console est confirmé par l'écran (« ack »). Sans confirmation,
//     la console renvoie un snapshot, puis prévient l'opérateur.
//  3. Chaque message porte un identifiant (mid), l'identifiant de l'émetteur (sid) et un numéro d'ordre (seq) :
//     un message plus ancien que le dernier reçu du même émetteur est ignoré.
//  4. Sur le canal « up », une console n'accepte QUE les types ci-dessous (UP_TYPES) : un écran (lien public)
//     ne peut jamais piloter les autres.

export const SCREEN_ROLES = ["display", "speaker"];

// messages dont la réception est confirmée par l'écran
export const TRACKED = new Set(["show", "update", "clear", "blank", "snapshot"]);

// seuls types qu'une console accepte venant d'un écran
export const UP_TYPES = new Set(["display?", "bg?", "speaker?", "ack", "mediaStatus"]);

// État complet de l'écran, construit à partir de l'état de la console (stateRef.current).
// Le logo n'y est pas (trop lourd pour un message) : il part à part, message « logo ».
export function buildSnapshot(st, extra = {}) {
  return {
    type: "snapshot",
    shown: st.shown && st.shown.kind !== "other" ? st.shown : null,
    blank: !!st.blank,
    layout: st.layout === "band" ? "band" : "full",
    bg: st.screenBg || null,
    textColor: st.screenText || null,
    settings: st.dset || null,
    ...extra,
  };
}
