-- A executer dans Supabase SQL Editor.
-- Chaque membre peut supprimer ses propres reservations.
-- Un administrateur peut supprimer toutes les reservations.

drop policy if exists "Reservations: delete admin only" on public.reservations;
drop policy if exists "Reservations: delete own or admin" on public.reservations;
drop policy if exists "Reservations: delete own" on public.reservations;
drop policy if exists "Reservations: admin delete all" on public.reservations;

grant delete on table public.reservations to authenticated;

create policy "Reservations: delete own" on public.reservations
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Reservations: admin delete all" on public.reservations
  for delete
  to authenticated
  using (public.is_admin());
