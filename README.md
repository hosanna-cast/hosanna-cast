# Hosanna Cast

Projet Next.js complet (App Router, Tailwind v4). À la racine du dépôt GitHub :
package.json, next.config.mjs, app/, lib/, public/, scripts/

1. npm install
2. Générer public/bible/lsg.json (voir scripts/usfm-to-json.mjs)
3. npm run dev  →  http://localhost:3000  (/control et /display)

Vercel : Framework Preset = Next.js, Root Directory = vide (racine du dépôt).

## Versions en ligne (Semeur, Segond 21, Français courant…) — API YouVersion

1. Créer une clé sur https://platform.youversion.com (gratuit) et accepter les licences des versions voulues.
2. Trouver les numéros : `YVP_APP_KEY=votre_clé npm run yv:check` (liste les Bibles françaises).
3. Les écrire dans `config/online-versions.json` (champ `yv`). Une version avec `"yv": null` est ignorée.
4. Vercel → Settings → Environment Variables : `YVP_APP_KEY` = votre clé (puis redéployer).

Les versions en ligne apparaissent à côté de LSG/OST/… ; leurs chapitres sont téléchargés à la demande
(recherche par référence uniquement, pas par mots).

### Menu « Ouvrir sur bible.com »
Pour une version sans accès API : mettre son numéro bible.com dans le champ `web` de `config/online-versions.json`
(le numéro est dans l'adresse : bible.com/bible/**63**/JHN.3.16 → 63). Un menu déroulant ouvre alors le chapitre du verset visé dans un nouvel onglet.

## Recherche d'images sur internet (régie technique)

Le champ « Image depuis internet » de la console cherche des images sans quitter l'appli : on tape un mot, on clique une vignette, elle est projetée.
Sans aucune configuration, il interroge Wikimedia Commons et Openverse (images libres de droits, gratuites, sans clé).

Pour chercher aussi dans Google Images (optionnel, 100 recherches gratuites par jour) :
1. https://programmablesearchengine.google.com → créer un moteur « Rechercher sur tout le Web », activer « Recherche d'images » → copier l'identifiant du moteur (cx).
2. https://console.cloud.google.com → activer « Custom Search API » → créer une clé API.
3. Vercel → Settings → Environment Variables : `GOOGLE_CSE_KEY` = la clé, `GOOGLE_CSE_CX` = l'identifiant du moteur (puis redéployer).

Dans tous les cas on peut aussi coller directement l'adresse d'une image dans le même champ.

## Sécurité de l'écran (canal privé)

Variable optionnelle `NEXT_PUBLIC_SCREEN_PRIVATE=1` (Vercel) : active les canaux Realtime privés. Prérequis : `supabase/realtime-security.sql`.
Procédure complète et retour arrière : voir `supabase/README.md`. Un administrateur peut régénérer le lien d'écran depuis le menu de la console.
