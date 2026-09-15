-- Met a jour le nom affiche d'Antoine dans Supabase Auth et dans son profil.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'full_name', 'Antoine - PUGNET',
    'first_name', 'Antoine',
    'family', 'PUGNET'
  )
where lower(email) = 'antoine.pugnet@gmail.com';

update public.profiles as profiles
set full_name = 'Antoine - PUGNET',
    first_name = 'Antoine',
    family = 'PUGNET'
from auth.users as users
where profiles.id = users.id
  and lower(users.email) = 'antoine.pugnet@gmail.com';
