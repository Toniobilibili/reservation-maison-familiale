create table if not exists public.info_items (
  id text primary key,
  title text not null,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.info_items enable row level security;

drop policy if exists "Info items: select authenticated" on public.info_items;
drop policy if exists "Info items: insert admin only" on public.info_items;
drop policy if exists "Info items: update admin only" on public.info_items;
drop policy if exists "Info items: delete admin only" on public.info_items;

create policy "Info items: select authenticated" on public.info_items
  for select
  using (auth.role() = 'authenticated');

create policy "Info items: insert admin only" on public.info_items
  for insert
  with check (public.is_admin());

create policy "Info items: update admin only" on public.info_items
  for update
  using (public.is_admin());

create policy "Info items: delete admin only" on public.info_items
  for delete
  using (public.is_admin());

insert into public.info_items (id, title, text, sort_order)
values
  ('adresse', 'Adresse', '12 route de la Plage, 83400 Hyères', 1),
  ('wifi', 'Wi-Fi', 'Nom : MaisonFamille / Code : Vacances2026', 2),
  ('arrivee', 'Arrivée', 'Arrivée possible après 16h. Clés dans la boîte à code.', 3),
  ('depart', 'Départ', 'Départ avant 11h. Merci de laisser la maison propre.', 4),
  ('regles', 'Règles', 'Pas de fêtes bruyantes, respect des voisins, animaux sur accord.', 5),
  ('contacts', 'Contacts utiles', 'Propriétaire : 06 00 00 00 00 / Assistance : 06 11 11 11 11', 6)
on conflict (id) do nothing;

drop trigger if exists info_items_set_updated_at on public.info_items;

create trigger info_items_set_updated_at
before update on public.info_items
for each row
execute function public.update_updated_at();
