-- Autorise chaque membre a modifier uniquement ses propres reservations.
drop policy if exists "Reservations: update own" on public.reservations;

create policy "Reservations: update own" on public.reservations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());