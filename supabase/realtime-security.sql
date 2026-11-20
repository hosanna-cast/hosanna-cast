-- Hosanna Cast : Phase 1 — canal d'écran privé (Realtime Authorization) + lien d'écran révocable
-- À coller UNE FOIS dans Supabase → SQL Editor → Run (après roles.sql : on utilise role_of() et require_admin()).
-- Sans danger : ne supprime rien, relançable, et sans effet tant que l'appli n'est pas passée en mode privé
-- (variable Vercel NEXT_PUBLIC_SCREEN_PRIVATE=1).
--
-- Deux sujets Realtime par église, construits avec le jeton d'écran (churches.screen_token) :
--   screen:<jeton>     consoles → écrans   lecture : qui a le jeton (écran, vue orateur) ou une console
--                                          écriture : UNIQUEMENT un membre connecté de l'église
--   screen-up:<jeton>  écrans → consoles   lecture et écriture : le jeton suffit (demande d'état, confirmations)
-- Résultat : avoir le lien /display?k=… permet de VOIR l'écran, plus de projeter à la place de l'équipe.
-- (Les consoles n'acceptent de toute façon que les messages « écran → console » sur screen-up : voir lib/screen.js.)

-- 1) retrouve l'église d'un sujet « screen:<jeton> » ou « screen-up:<jeton> »
create or replace function public.screen_church(topic text)
returns uuid language sql security definer stable set search_path = public as $$
  select c.id from public.churches c
  where topic ~ '^screen(-up)?:'
    and c.screen_token::text = regexp_replace(topic, '^screen(-up)?:', '')
  limit 1
$$;

create or replace function public.screen_can_read(topic text)
returns boolean language plpgsql security definer stable set search_path = public as $$
begin
  return public.screen_church(topic) is not null;
end $$;

create or replace function public.screen_can_write(topic text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare c uuid := public.screen_church(topic);
begin
  if c is null then return false; end if;
  if topic like 'screen-up:%' then return true; end if;                 -- écran → console : le jeton suffit
  return auth.uid() is not null and public.role_of(c) is not null;       -- console → écran : membre connecté de l'église
end $$;

revoke all on function public.screen_church(text), public.screen_can_read(text), public.screen_can_write(text) from public;
grant execute on function public.screen_can_read(text), public.screen_can_write(text) to anon, authenticated;

-- 2) règles sur les messages Realtime (canaux privés uniquement ; tout autre sujet privé reste refusé)
drop policy if exists "screen_read" on realtime.messages;
create policy "screen_read" on realtime.messages
  for select to anon, authenticated
  using (extension in ('broadcast', 'presence') and public.screen_can_read(realtime.topic()));

drop policy if exists "screen_write" on realtime.messages;
create policy "screen_write" on realtime.messages
  for insert to anon, authenticated
  with check (extension in ('broadcast', 'presence') and public.screen_can_write(realtime.topic()));

-- 3) recherche par jeton plus rapide
create index if not exists churches_screen_token_idx on public.churches ((screen_token::text));

-- 4) lien d'écran révocable : réservé aux administrateurs (bouton « Régénérer le lien écran » du menu)
create or replace function public.rotate_screen_token()
returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.require_admin(); t text := replace(gen_random_uuid()::text, '-', '');
begin
  execute format('update public.churches set screen_token = %L where id = %L', t, c);
  return t;
end $$;
revoke all on function public.rotate_screen_token() from public;
grant execute on function public.rotate_screen_token() to authenticated;
