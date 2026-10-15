-- Hosanna Cast : nouveau rôle « Annonces » (accès uniquement à l'onglet Annonces)
-- À coller UNE FOIS dans Supabase → SQL Editor → Run, si roles.sql et temporaire.sql ont déjà été exécutés.
-- (Sur une installation neuve, roles.sql et temporaire.sql contiennent déjà tout : pas besoin de ce fichier.)
-- Ne supprime aucune donnée. Relançable sans danger.

-- 1) Rôle normalisé : admin | assistant | annonces | standard
create or replace function public.role_of(church uuid)
returns text language sql security definer stable set search_path = public as $$
  select case when m.role in ('owner','admin') then 'admin'
              when m.role = 'assistant' then 'assistant'
              when m.role = 'annonces' then 'annonces'
              else 'standard' end
  from memberships m where m.user_id = auth.uid() and m.church_id = church limit 1
$$;

-- 2) Invitations : le nouveau rôle est accepté
alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check check (role in ('admin','assistant','standard','annonces'));

-- 3) Fonctions d'équipe (mêmes que roles.sql, avec le nouveau rôle)
create or replace function public.list_members()
returns table (user_id uuid, first_name text, last_name text, email text, role text, is_me boolean)
language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.require_admin();
begin
  return query
    select m.user_id, p.first_name::text, p.last_name::text, u.email::text,
           case when m.role in ('owner','admin') then 'admin' when m.role = 'assistant' then 'assistant' when m.role = 'annonces' then 'annonces' else 'standard' end,
           (m.user_id = auth.uid())
    from memberships m
    join auth.users u on u.id = m.user_id
    left join profiles p on p.user_id = m.user_id
    where m.church_id = c
    order by 5, 2, 4;
end $$;

create or replace function public.set_member_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin(); admins int;
begin
  if new_role not in ('admin','assistant','standard','annonces') then raise exception 'Rôle inconnu'; end if;
  select count(*) into admins from memberships where church_id = c and role in ('owner','admin');
  if new_role <> 'admin' and admins <= 1
     and exists (select 1 from memberships where church_id = c and user_id = target and role in ('owner','admin')) then
    raise exception 'Il faut garder au moins un administrateur';
  end if;
  update memberships set role = new_role where church_id = c and user_id = target;
end $$;

create or replace function public.create_invite(new_role text)
returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin(); k text;
begin
  if new_role not in ('admin','assistant','standard','annonces') then raise exception 'Rôle inconnu'; end if;
  insert into invites (church_id, role) values (c, new_role) returning code into k;
  return k;
end $$;

-- 4) Le rôle « Annonces » peut lire / écrire les annonces (photos et vidéos)
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements
  for select to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant','annonces'));
drop policy if exists "announcements_write" on public.announcements;
create policy "announcements_write" on public.announcements
  for all to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant','annonces'))
  with check (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant','annonces'));

drop policy if exists "announcements_files_insert" on storage.objects;
create policy "announcements_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcements' and (storage.foldername(name))[1] = public.my_church()::text
              and public.role_of(public.my_church()) in ('admin','assistant','annonces'));
drop policy if exists "announcements_files_delete" on storage.objects;
create policy "announcements_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'announcements' and (storage.foldername(name))[1] = public.my_church()::text
         and public.role_of(public.my_church()) in ('admin','assistant','annonces'));

-- 5) Le rôle « Annonces » n'a accès ni aux versets, ni aux notes, ni aux chants
drop policy if exists "chants_only_for_standard" on public.library_items;
create policy "chants_only_for_standard" on public.library_items
  as restrictive for all to authenticated
  using (public.role_of(church_id) in ('admin','assistant') or (kind = 'chants' and public.role_of(church_id) <> 'annonces'))
  with check (public.role_of(church_id) in ('admin','assistant') or (kind = 'chants' and public.role_of(church_id) <> 'annonces'));
