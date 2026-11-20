-- Hosanna Cast : plan de culte (ordre du service) partagé entre tous les appareils de l'église
-- À coller UNE FOIS dans Supabase → SQL Editor → Run (après roles.sql : on utilise my_church() et role_of()).
-- Ne supprime rien d'existant, relançable sans danger.
--
-- Un plan = un culte (nom + date + liste ordonnée d'éléments : versets, chants, notes, annonces, textes).
-- Les éléments sont des RÉFÉRENCES (un chant = son identifiant dans la bibliothèque), pas des copies :
-- si le chant est corrigé dans la bibliothèque, le plan projette la version corrigée.
--
-- Droits : lecture = tous les membres sauf le profil « Annonces » ; écriture = administrateur et aide écran.
-- Modifications simultanées : chaque enregistrement vérifie le numéro de révision (rev). Si quelqu'un d'autre
-- a modifié le plan entre-temps, l'appli recharge sa version au lieu d'écraser en silence.

create table if not exists public.service_plans (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  service_date  date,
  items         jsonb not null default '[]'::jsonb
                check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  rev           integer not null default 0,
  created_by    uuid default auth.uid(),
  updated_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists service_plans_church_idx
  on public.service_plans (church_id, service_date desc nulls last, created_at desc);

-- la révision n'avance que si la liste d'éléments change (renommer un plan ne gêne pas un enregistrement en cours)
create or replace function public.service_plans_touch()
returns trigger language plpgsql as $$
begin
  if new.items is distinct from old.items then new.rev := old.rev + 1; end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists service_plans_touch on public.service_plans;
create trigger service_plans_touch before update on public.service_plans
  for each row execute function public.service_plans_touch();

alter table public.service_plans enable row level security;

drop policy if exists "service_plans_read" on public.service_plans;
create policy "service_plans_read" on public.service_plans
  for select to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) <> 'annonces');

drop policy if exists "service_plans_write" on public.service_plans;
create policy "service_plans_write" on public.service_plans
  for all to authenticated
  using (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant'))
  with check (church_id = public.my_church() and public.role_of(church_id) in ('admin','assistant'));

-- mise à jour en direct entre appareils
do $$ begin alter publication supabase_realtime add table public.service_plans; exception when others then null; end $$;
