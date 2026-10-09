// Rôles de l'équipe. Une seule source de vérité : pour changer un droit, on le change ici.
//
//  admin     : accès à tout + espace Administration (équipe, invitations)
//  assistant : « Aide écran » : pilote la projection (Bible, notes, chants) depuis un 2e appareil, sans administration
//  standard  : accès uniquement aux chants
export const ROLES = {
  admin:     { label: "Administrateur", desc: "Accès à tout et gère l'équipe" },
  assistant: { label: "Aide écran",     desc: "Aide à projeter (Bible, notes, chants) depuis un 2e appareil" },
  standard:  { label: "Chants",         desc: "Accès uniquement aux chants" },
};
export const ROLE_IDS = Object.keys(ROLES);

// « owner » = ancien nom du créateur de l'église : il est administrateur.
// Tout rôle inconnu tombe sur le plus restreint (standard).
export const normalizeRole = (r) => (r === "owner" || r === "admin" ? "admin" : r === "assistant" ? "assistant" : "standard");

const TABS = { admin: ["bible", "notes", "chants"], assistant: ["bible", "notes", "chants"], standard: ["chants"] };
export const tabsFor = (role) => TABS[normalizeRole(role)];
export const isAdmin = (role) => normalizeRole(role) === "admin";
