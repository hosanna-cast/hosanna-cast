-- Hosanna Cast : rôles, équipe et invitations
-- À coller UNE FOIS dans Supabase → SQL Editor → Run. Ne supprime rien : tout est ajouté.
-- Hypothèse : la table memberships a les colonnes user_id, church_id, role (vérifiez avec : select * from memberships limit 1;)

-- 1) Rôle (normalisé) de l'utilisateur connecté dans une église : admin | assistant | standard
create or replace function public.role_of(church uuid)
returns text language sql security definer stable set search_path = public as $$
  select case when m.role in ('owner','admin') then 'admin'
              when m.role = 'assistant' then 'assistant'
              else 'standard' end
  from memberships m where m.user_id = auth.uid() and m.church_id = church limit 1
$$;

-- 2) Invitations (un lien = une personne, valable 7 jours)
create table if not exists public.invites (
  code text primary key default left(replace(gen_random_uuid()::text, '-', ''), 20),
  church_id uuid not null references public.churches(id) on delete cascade,
  role text not null check (role in ('admin','assistant','standard')),
  created_by uuid default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;     -- aucun accès direct : tout passe par les fonctions ci-dessous

-- 3) Fonctions réservées aux administrateurs de l'église
create or replace function public.my_church()
returns uuid language sql security definer stable set search_path = public as $$
  select church_id from memberships where user_id = auth.uid() limit 1
$$;

create or replace function public.require_admin()
returns uuid language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.my_church();
begin
  if c is null or public.role_of(c) <> 'admin' then raise exception 'Réservé aux administrateurs'; end if;
  return c;
end $$;

create or replace function public.list_members()
returns table (user_id uuid, first_name text, last_name text, email text, role text, is_me boolean)
language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.require_admin();
begin
  return query
    select m.user_id, p.first_name::text, p.last_name::text, u.email::text,
           case when m.role in ('owner','admin') then 'admin' when m.role = 'assistant' then 'assistant' else 'standard' end,
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
  if new_role not in ('admin','assistant','standard') then raise exception 'Rôle inconnu'; end if;
  select count(*) into admins from memberships where church_id = c and role in ('owner','admin');
  if new_role <> 'admin' and admins <= 1
     and exists (select 1 from memberships where church_id = c and user_id = target and role in ('owner','admin')) then
    raise exception 'Il faut garder au moins un administrateur';
  end if;
  update memberships set role = new_role where church_id = c and user_id = target;
end $$;

create or replace function public.remove_member(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin(); admins int;
begin
  select count(*) into admins from memberships where church_id = c and role in ('owner','admin');
  if admins <= 1 and exists (select 1 from memberships where church_id = c and user_id = target and role in ('owner','admin')) then
    raise exception 'Il faut garder au moins un administrateur';
  end if;
  delete from memberships where church_id = c and user_id = target;
end $$;

create or replace function public.create_invite(new_role text)
returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin(); k text;
begin
  if new_role not in ('admin','assistant','standard') then raise exception 'Rôle inconnu'; end if;
  insert into invites (church_id, role) values (c, new_role) returning code into k;
  return k;
end $$;

create or replace function public.list_invites()
returns table (code text, role text, expires_at timestamptz)
language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.require_admin();
begin
  return query select i.code, i.role, i.expires_at from invites i where i.church_id = c and i.expires_at > now() order by i.created_at desc;
end $$;

create or replace function public.revoke_invite(c_code text)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin();
begin
  delete from invites where code = c_code and church_id = c;
end $$;

-- 4) Rejoindre une église avec un lien d'invitation
create or replace function public.invite_info(c_code text)           -- public : sert à afficher « Rejoindre l'église X »
returns table (church_name text, role text)
language sql security definer stable set search_path = public as $$
  select ch.name::text, i.role from invites i join churches ch on ch.id = i.church_id
  where i.code = c_code and i.expires_at > now()
$$;

create or replace function public.join_church(c_code text, first text, last text)
returns void language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then raise exception 'Ce compte appartient déjà à une église'; end if;
  select * into inv from invites where code = c_code and expires_at > now();
  if not found then raise exception 'Invitation invalide ou expirée'; end if;
  insert into memberships (user_id, church_id, role) values (auth.uid(), inv.church_id, inv.role);
  update profiles set first_name = first, last_name = last where user_id = auth.uid();
  if not found then insert into profiles (user_id, first_name, last_name) values (auth.uid(), first, last); end if;
  delete from invites where code = c_code;                           -- lien à usage unique
end $$;

-- 5) Droits d'appel
revoke all on function public.require_admin(), public.my_church(), public.list_members(), public.set_member_role(uuid, text),
  public.remove_member(uuid), public.create_invite(text), public.list_invites(), public.revoke_invite(text),
  public.join_church(text, text, text), public.invite_info(text), public.role_of(uuid) from public;
grant execute on function public.list_members(), public.set_member_role(uuid, text), public.remove_member(uuid),
  public.create_invite(text), public.list_invites(), public.revoke_invite(text), public.join_church(text, text, text),
  public.role_of(uuid) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;

-- 6) Protection côté base : un profil « Chants » ne peut lire/écrire que les chants (s'ajoute aux règles existantes)
drop policy if exists "chants_only_for_standard" on public.library_items;
create policy "chants_only_for_standard" on public.library_items
  as restrictive for all to authenticated
  using (kind = 'chants' or public.role_of(church_id) in ('admin','assistant'))
  with check (kind = 'chants' or public.role_of(church_id) in ('admin','assistant'));
