-- Autorise tout utilisateur connecte a modifier ou supprimer les reservations.
drop policy if exists "Reservations: update authenticated" on public.reservations;
drop policy if exists "Reservations: delete authenticated" on public.reservations;

create policy "Reservations: update authenticated" on public.reservations
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Reservations: delete authenticated" on public.reservations
  for delete
  to authenticated
  using (auth.uid() is not null);