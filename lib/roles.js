// Rôles de l'équipe. Une seule source de vérité : pour changer un droit, on le change ici.
//
//  admin     : accès à tout + espace Administration (équipe, invitations)
//  assistant : « Aide écran » : pilote la projection (Bible, notes, chants) depuis un 2e appareil, sans administration
//  orateur   : Bible + notes ; il projette lui-même ses versets (pas de chants, pas d'administration)
//  standard  : accès uniquement aux chants
//  annonces  : accès uniquement aux annonces (photos et vidéos à projeter)
export const ROLES = {
  admin:     { label: "Administrateur", desc: "Accès à tout et gère l'équipe" },
  assistant: { label: "Aide écran",     desc: "Aide à projeter (Bible, notes, chants) depuis un 2e appareil" },
  orateur:   { label: "Orateur",       desc: "Bible et notes : projette ses versets lui-même" },
  standard:  { label: "Chants",         desc: "Accès uniquement aux chants" },
  annonces:  { label: "Annonces",       desc: "Accès uniquement aux annonces (photos et vidéos)" },
};
export const ROLE_IDS = Object.keys(ROLES);

// « owner » = ancien nom du créateur de l'église : il est administrateur.
// Tout rôle inconnu tombe sur le plus restreint (standard).
export const normalizeRole = (r) => (r === "owner" || r === "admin" ? "admin" : r === "assistant" ? "assistant" : r === "orateur" ? "orateur" : r === "annonces" ? "annonces" : "standard");

const TABS = { admin: ["bible", "notes", "chants", "annonces"], assistant: ["bible", "notes", "chants", "annonces"], orateur: ["bible", "notes"], standard: ["chants"], annonces: ["annonces"] };
export const tabsFor = (role) => TABS[normalizeRole(role)];
export const isAdmin = (role) => normalizeRole(role) === "admin";
