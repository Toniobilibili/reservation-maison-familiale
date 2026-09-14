-- Met a jour la couleur de PUGNET dans une base deja configuree.
update public.family_settings
set bg_color = '#ffedd5',
    border_color = '#ea580c',
    text_color = '#9a3412',
    updated_at = now()
where family = 'PUGNET';