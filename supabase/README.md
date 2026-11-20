# Base de données Hosanna Cast

Fichiers à exécuter dans Supabase → SQL Editor, dans cet ordre (chacun est relançable) :

1. `roles.sql` : rôles, équipe, invitations (`role_of`, `require_admin`…)
2. `role-annonces.sql`
3. `temporaire.sql` : playlists de chants, annonces
4. `realtime-security.sql` : **canal d'écran privé** + lien d'écran révocable (Phase 1)

## Passer le canal d'écran en privé (sans coupure)

1. Déployer le code (le mode public reste actif : rien ne change, mais l'écran récupère déjà son état).
2. Exécuter `realtime-security.sql`.
3. Vercel → Settings → Environment Variables : `NEXT_PUBLIC_SCREEN_PRIVATE` = `1`, puis redéployer.
4. Rouvrir **tous** les onglets `/control`, `/display`, `/speaker` (les anciens restent sur le canal public).
5. Test : le voyant « Écran connecté » passe au vert, un verset s'affiche, recharger `/display` ne le vide plus.
6. Seulement quand tout marche : Supabase → Realtime → Settings → désactiver « Allow public access ».

Retour arrière : supprimer la variable et redéployer (le mode public revient).

## Schéma de référence

Les tables de base (`churches`, `memberships`, `profiles`, `library_items`) et leurs règles RLS ne sont pas décrites
dans ces fichiers. Pour les versionner exactement, exécuter ces deux requêtes et conserver le résultat :

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname in ('public', 'realtime') order by tablename, policyname;
```
