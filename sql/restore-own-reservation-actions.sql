-- Restreint la modification et la suppression au createur de la reservation.
drop policy if exists "Reservations: update authenticated" on public.reservations;
drop policy if exists "Reservations: delete authenticated" on public.reservations;
drop policy if exists "Reservations: update own" on public.reservations;
drop policy if exists "Reservations: delete own" on public.reservations;

create policy "Reservations: update own" on public.reservations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Reservations: delete own" on public.reservations
  for delete
  to authenticated
  using (user_id = auth.uid());