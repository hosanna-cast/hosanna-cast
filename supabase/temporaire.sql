-- Hosanna Cast : playlists de chants + annonces (photos / vidéos), effacées automatiquement après 3 jours
-- À coller UNE FOIS dans Supabase → SQL Editor → Run (après roles.sql, car on utilise my_church() et role_of()).
-- Ne supprime rien d'existant : tout est ajouté. Tu peux le relancer sans danger (utile après une mise à jour).

-- 1) Playlists de chants ---------------------------------------------------------------
create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  name        text not null,
  chant_ids   jsonb not null default '[]'::jsonb,        -- liste ordonnée des identifiants de chants
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '3 days'
);
alter table public.playlists enable row level security;
drop policy if exists "playlists_members" on public.playlists;
create policy "playlists_members" on public.playlists
  for all to authenticated
  using (church_id = public.my_church())
  with check (church_id = public.my_church());

-- 2) Annonces : photos et vidéos ---------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  kind        text not null check (kind in ('image','video')),
  name        text not null,
  path        text not null,                               -- chemin du fichier dans le stockage
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '3 days'
);
-- Annonces récurrentes (ex. temps de prière chaque mardi) : gardées, sans effacement automatique
alter table public.announcements add column if not exists keep boolean not null default false;
alter table public.announcements add column if not exists days smallint[] not null default '{}';   -- jours (0 = dimanche … 6 = samedi), facultatif
alter table public.announcements enable row level security;
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements
  for select to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant'));
drop policy if exists "announcements_write" on public.announcements;
create policy "announcements_write" on public.announcements
  for all to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant'))
  with check (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant'));

-- 3) Stockage des fichiers (lecture publique : l'écran de projection n'est pas connecté) ----------
-- Taille max par fichier : 50 Mo (limite du forfait gratuit Supabase). Modifiable ici si tu passes à un forfait payant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcements', 'announcements', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "announcements_files_read" on storage.objects;
create policy "announcements_files_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'announcements' and (storage.foldername(name))[1] = public.my_church()::text);
drop policy if exists "announcements_files_insert" on storage.objects;
create policy "announcements_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcements' and (storage.foldername(name))[1] = public.my_church()::text
              and public.role_of(public.my_church()) in ('admin','assistant'));
drop policy if exists "announcements_files_delete" on storage.objects;
create policy "announcements_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'announcements' and (storage.foldername(name))[1] = public.my_church()::text
         and public.role_of(public.my_church()) in ('admin','assistant'));

-- 4) Mise à jour en direct entre appareils ------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.playlists;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when others then null; end $$;

-- Le nettoyage (après 3 jours) est fait par l'appli : à chaque ouverture de la console, les playlists et
-- fichiers expirés sont supprimés. Ils disparaissent de toute façon de l'affichage dès l'expiration.
