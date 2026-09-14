-- Supprime la validation manuelle : les anciennes demandes deviennent validees.
update public.reservations
set status = 'approved',
    updated_at = now()
where status = 'pending';