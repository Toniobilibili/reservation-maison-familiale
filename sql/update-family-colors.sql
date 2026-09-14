-- Uniformise les couleurs NGUYEN et PUGNET dans une base deja configuree.
update public.family_settings
set bg_color = '#fef9c3',
    border_color = '#eab308',
    text_color = '#713f12',
    updated_at = now()
where family = 'NGUYEN';

update public.family_settings
set bg_color = '#ffedd5',
    border_color = '#ea580c',
    text_color = '#9a3412',
    updated_at = now()
where family = 'PUGNET';