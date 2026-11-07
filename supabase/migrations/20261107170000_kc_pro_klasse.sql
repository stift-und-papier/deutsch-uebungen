-- Kerncurriculum wird pro Klasse festgelegt (an der KGS gibt es keine gemischten Klassen).
-- Die Spalte schueler.kerncurriculum bleibt bestehen (die Auswertung nutzt sie), wird aber
-- automatisch aus der Klasse übernommen.

alter table public.klassen
  add column kerncurriculum text check (kerncurriculum in ('Gymnasium', 'Realschule', 'Hauptschule'));

-- Neue Schüler:innen übernehmen das KC ihrer Klasse.
create function public.kc_von_klasse() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.kerncurriculum := (select k.kerncurriculum from public.klassen k where k.id = new.klasse_id);
  return new;
end
$$;
create trigger schueler_kc_von_klasse
  before insert on public.schueler
  for each row execute function public.kc_von_klasse();

-- Ändert sich das KC der Klasse, gilt es sofort für alle in der Klasse.
create function public.kc_an_schueler() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.schueler set kerncurriculum = new.kerncurriculum where klasse_id = new.id;
  return new;
end
$$;
create trigger klasse_kc_an_schueler
  after update of kerncurriculum on public.klassen
  for each row when (old.kerncurriculum is distinct from new.kerncurriculum)
  execute function public.kc_an_schueler();

-- Bestehende Klassen: das bisher häufigste KC der Klasse übernehmen.
update public.klassen k
set kerncurriculum = (
  select s.kerncurriculum from public.schueler s
  where s.klasse_id = k.id and s.kerncurriculum is not null
  group by s.kerncurriculum order by count(*) desc limit 1
)
where k.kerncurriculum is null;

-- Trigger-Funktionen braucht niemand direkt aufzurufen.
revoke execute on function public.kc_von_klasse(), public.kc_an_schueler() from public, anon, authenticated;
