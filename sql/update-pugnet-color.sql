-- Met a jour la couleur de PUGNET dans une base deja configuree.
update public.family_settings
set bg_color = '#fff7ed',
    border_color = '#f97316',
    text_color = '#c2410c',
    updated_at = now()
where family = 'PUGNET';