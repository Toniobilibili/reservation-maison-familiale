-- Crée la table des profils des utilisateurs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'member')),
  created_at timestamp with time zone default now()
);

-- Crée la table des réservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  guests integer not null check (guests > 0),
  comment text,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reservations enable row level security;
alter table public.profiles enable row level security;

-- Profils: chaque utilisateur peut lire son propre profil, l'admin peut tout lire.
create policy "Profiles: select self or admin" on public.profiles
  for select
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Profiles: insert self" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "Profiles: update admin only" on public.profiles
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Réservations: les membres voient les réservations validées et leurs propres demandes;
-- les membres créent des demandes, les admins peuvent modifier ou supprimer.
create policy "Reservations: select member access" on public.reservations
  for select
  using (
    status = 'approved'
    or user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Reservations: insert own request" on public.reservations
  for insert
  with check (user_id = auth.uid());

create policy "Reservations: update admin only" on public.reservations
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Reservations: delete admin only" on public.reservations
  for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Vérifie qu’aucune réservation validée ne chevauche la nouvelle réservation.
create or replace function public.reservation_no_overlap()
returns trigger as $$
declare
  overlap_count int;
begin
  if new.status = 'rejected' then
    return new;
  end if;

  if new.start_date >= new.end_date then
    raise exception 'La date de départ doit être après la date d''arrivée.';
  end if;

  select count(*) into overlap_count
  from public.reservations
  where id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    and status = 'approved'
    and start_date <= new.end_date
    and end_date >= new.start_date;

  if overlap_count > 0 then
    raise exception 'Cette période chevauche une réservation validée existante.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger pour mise à jour du champ updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger reservations_set_updated_at
before update on public.reservations
for each row
execute function public.update_updated_at();

create trigger reservations_check_overlap
before insert or update on public.reservations
for each row
execute function public.reservation_no_overlap();
