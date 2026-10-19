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
