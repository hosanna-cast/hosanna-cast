import { redirect } from "next/navigation";

// Page d'accueil : le login renvoie ici, on envoie directement à la console.
// (Si la personne n'est pas connectée, le middleware la ramène sur /login.)
// La vue orateur reste disponible sur /speaker?k=<jeton>.
export default function Home() {
  redirect("/control");
}
