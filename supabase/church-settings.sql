-- Hosanna Cast : réglages PARTAGÉS par toute l'église + langue
-- À coller UNE FOIS dans Supabase → SQL Editor → Run (après roles.sql : on utilise my_church() et role_of()).
-- Ne supprime rien d'existant, relançable sans danger.
--
-- Avant : le fond, le logo et les réglages d'affichage étaient gardés dans le navigateur de la régie (localStorage) ;
--         chaque nouvel appareil ou chaque nouveau membre devait tout reconfigurer.
-- Après : ils sont enregistrés une fois pour l'église. Tout membre qui se connecte retrouve le même écran
--         (les chants, notes, playlists, annonces et plans de culte étaient déjà partagés par église).
--
-- Droits : lecture = tous les membres de l'église ; écriture = administrateurs uniquement.

create table if not exists public.church_settings (
  church_id      uuid primary key references public.churches(id) on delete cascade,
  display        jsonb not null default '{}'::jsonb check (jsonb_typeof(display) = 'object'),   -- bandeau, plein écran, logo, transition
  bgs            jsonb not null default '{}'::jsonb check (jsonb_typeof(bgs) = 'object'),       -- fonds préparés, fond et couleur de texte appliqués
  logo           text  check (logo is null or (logo like 'data:image/%' and char_length(logo) < 400000)),
  default_locale text  not null default 'fr' check (default_locale in ('fr', 'en')),            -- langue proposée aux membres sans préférence
  updated_by     uuid  default auth.uid(),
  updated_at     timestamptz not null default now()
);

alter table public.church_settings enable row level security;

drop policy if exists "church_settings_read" on public.church_settings;
create policy "church_settings_read" on public.church_settings
  for select to authenticated
  using (church_id = public.my_church());

drop policy if exists "church_settings_insert" on public.church_settings;
create policy "church_settings_insert" on public.church_settings
  for insert to authenticated
  with check (church_id = public.my_church() and public.role_of(church_id) = 'admin');

drop policy if exists "church_settings_update" on public.church_settings;
create policy "church_settings_update" on public.church_settings
  for update to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) = 'admin')
  with check (church_id = public.my_church() and public.role_of(church_id) = 'admin');

-- mise à jour en direct entre appareils
do $$ begin alter publication supabase_realtime add table public.church_settings; exception when others then null; end $$;

-- Langue de chaque personne (français / anglais) ----------------------------------------------------
alter table public.profiles add column if not exists locale text;
do $$ begin
  alter table public.profiles add constraint profiles_locale_check check (locale is null or locale in ('fr', 'en'));
exception when others then null; end $$;

create or replace function public.set_my_locale(loc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if loc not in ('fr', 'en') then raise exception 'Langue inconnue'; end if;
  update profiles set locale = loc where user_id = auth.uid();
  if not found then
    begin insert into profiles (user_id, locale) values (auth.uid(), loc);
    exception when others then null;     -- profil incomplet : le cookie du navigateur garde la langue
    end;
  end if;
end $$;
revoke all on function public.set_my_locale(text) from public;
grant execute on function public.set_my_locale(text) to authenticated;
