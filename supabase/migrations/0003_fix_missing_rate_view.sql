-- Fix: hour_entries_with_amount gebruikte een gewone JOIN LATERAL naar
-- rates, wat een uurregistratie volledig liet verdwijnen (uit Mijn uren,
-- het admin-overzicht, de export, ...) zodra er nog geen tarief bestond
-- voor die combinatie van juf + categorie. Bijvoorbeeld: een nieuwe
-- categorie waarvoor de admin nog geen uurloon heeft ingesteld.
--
-- LEFT JOIN LATERAL laat de registratie zichtbaar blijven met uurloon en
-- bedrag op NULL in plaats van de rij stilletjes te droppen.

create or replace view hour_entries_with_amount
  with (security_invoker = true)
as
select
  he.*,
  r.uurloon,
  case when r.uurloon is not null then he.aantal_uren * r.uurloon else null end as bedrag
from hour_entries he
left join lateral (
  select uurloon
  from rates
  where rates.profile_id = he.profile_id
    and rates.category_id = he.category_id
    and rates.geldig_vanaf <= he.datum
  order by geldig_vanaf desc
  limit 1
) r on true;
