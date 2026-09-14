-- Crée la table des profils des utilisateurs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  first_name text,
  family text,
  role text not null check (role in ('admin', 'member')),
  created_at timestamp with time zone default now()
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists family text;

-- Crée la table des réservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  guests integer not null check (guests > 0),
  comment text,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'approved',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reservations enable row level security;
alter table public.profiles enable row level security;

create table if not exists public.family_periods (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  family text not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  check (end_date >= start_date)
);

create table if not exists public.planning_imports (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  file_name text not null,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'validated')),
  extracted_periods jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now()
);

create table if not exists public.family_settings (
  family text primary key,
  label text not null,
  bg_color text not null,
  border_color text not null,
  text_color text not null,
  updated_at timestamp with time zone default now()
);

insert into public.family_settings (family, label, bg_color, border_color, text_color)
values
  ('PUGNET', 'PUGNET', '#fff7ed', '#f97316', '#c2410c'),
  ('PLAGNOL', 'PLAGNOL', '#f3e8ff', '#7e22ce', '#581c87'),
  ('NGUYEN', 'NGUYEN', '#fef3c7', '#ca8a04', '#713f12'),
  ('BRETEAU', 'BRETEAU', '#e0f2fe', '#0284c7', '#0c4a6e')
on conflict (family) do nothing;

alter table public.family_periods enable row level security;
alter table public.planning_imports enable row level security;
alter table public.family_settings enable row level security;

-- Fonction utilitaire pour vérifier si l'utilisateur connecté est admin.
-- Utilise SECURITY DEFINER pour éviter la récursion RLS lors de l'accès à la table profiles.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.profiles where id = auth.uid()::uuid and role = 'admin'
  );
$$;

-- Crée automatiquement le profil membre après une inscription Supabase.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, first_name, family, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'family', 'Famille'),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'family',
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Profils: chaque utilisateur peut lire son propre profil, l'admin peut tout lire.
drop policy if exists "Profiles: select self or admin" on public.profiles;
drop policy if exists "Profiles: insert self" on public.profiles;
drop policy if exists "Profiles: update admin only" on public.profiles;

create policy "Profiles: select self or admin" on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.reservations
      where reservations.user_id = profiles.id
        and reservations.status = 'approved'
    )
  );

create policy "Profiles: insert self" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "Profiles: update admin only" on public.profiles
  for update
  using (public.is_admin());

-- Réservations: les membres voient les réservations validées et leurs propres demandes;
-- les membres créent des demandes, les admins peuvent modifier ou supprimer.
drop policy if exists "Reservations: select member access" on public.reservations;
drop policy if exists "Reservations: insert own request" on public.reservations;
drop policy if exists "Reservations: update admin only" on public.reservations;
drop policy if exists "Reservations: delete admin only" on public.reservations;
drop policy if exists "Reservations: delete own or admin" on public.reservations;

create policy "Reservations: select member access" on public.reservations
  for select
  using (
    status = 'approved'
    or user_id = auth.uid()
    or public.is_admin()
  );

create policy "Reservations: insert own request" on public.reservations
  for insert
  with check (user_id = auth.uid());

create policy "Reservations: update admin only" on public.reservations
  for update
  using (public.is_admin());

grant delete on table public.reservations to authenticated;

create policy "Reservations: delete own" on public.reservations
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Reservations: admin delete all" on public.reservations
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Family periods: authenticated read" on public.family_periods;
drop policy if exists "Family periods: admin write" on public.family_periods;
create policy "Family periods: authenticated read" on public.family_periods
  for select using (auth.uid() is not null);
create policy "Family periods: admin write" on public.family_periods
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Planning imports: admin access" on public.planning_imports;
create policy "Planning imports: admin access" on public.planning_imports
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Family settings: authenticated read" on public.family_settings;
drop policy if exists "Family settings: admin write" on public.family_settings;
create policy "Family settings: authenticated read" on public.family_settings
  for select using (auth.uid() is not null);
create policy "Family settings: admin write" on public.family_settings
  for all using (public.is_admin()) with check (public.is_admin());

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
    and status <> 'rejected'
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

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row
execute function public.update_updated_at();

drop trigger if exists reservations_check_overlap on public.reservations;
create trigger reservations_check_overlap
before insert or update on public.reservations
for each row
execute function public.reservation_no_overlap();

drop trigger if exists family_periods_set_updated_at on public.family_periods;
create trigger family_periods_set_updated_at
before update on public.family_periods
for each row execute function public.update_updated_at();
