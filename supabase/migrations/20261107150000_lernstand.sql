-- =====================================================================
-- Etappe 2 (Teil 2): Lernstand und Entwicklung
-- =====================================================================
-- STAND (nur Lehrkraft): gewichteter Durchschnitt der letzten gewerteten Versuche je Kompetenz.
--   * pro Aufgabe und Tag zählt nur der erste Versuch; Versuche nach "Lösung ansehen" zählen nie
--   * Punkte = Anteil richtig × Höchstwert der Schwierigkeit (leicht 70 / mittel 85 / schwer 100)
--   * neuere Versuche zählen mehr (Faktor 0,85 pro älterem Versuch)
--   * 5 Stufen: 0 = "--", 1 = "-", 2 = "o", 3 = "+", 4 = "++"
-- ENTWICKLUNG: Vergleich mit Startstand oder Stand vor X Wochen; Trend nur bei genug neuen
--   Versuchen UND deutlicher Veränderung (Schutz vor Zufall).
-- Schüler:innen bekommen NIE Punkte oder Stufen – nur eine von vier Kategorien (schueler_entwicklung).

-- ---------- Einstellungen pro Lehrkraft ----------

create table public.einstellungen (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  min_versuche integer not null default 4 check (min_versuche between 1 and 50),
  anzahl_letzte integer not null default 10 check (anzahl_letzte between 3 and 100),
  abklingen numeric(3, 2) not null default 0.85 check (abklingen > 0 and abklingen <= 1),
  punkte_leicht integer not null default 70 check (punkte_leicht between 1 and 100),
  punkte_mittel integer not null default 85 check (punkte_mittel between 1 and 100),
  punkte_schwer integer not null default 100 check (punkte_schwer between 1 and 100),
  grenze_minus integer not null default 35,
  grenze_o integer not null default 55,
  grenze_plus integer not null default 70,
  grenze_plusplus integer not null default 85,
  trend_min_neue integer not null default 4 check (trend_min_neue between 1 and 50),
  trend_min_diff integer not null default 15 check (trend_min_diff between 1 and 100),
  -- null = mit dem Startstand vergleichen, sonst mit dem Stand vor so vielen Wochen
  vergleich_wochen integer check (vergleich_wochen between 1 and 52),
  texte jsonb not null default '{
    "deutlich": "Hier bist du deutlich besser geworden!",
    "besser": "Hier wirst du besser.",
    "dranbleiben": "Hier bleibst du dran – Üben lohnt sich hier besonders.",
    "erste": "Hier sammeln wir noch deine ersten Ergebnisse.",
    "gelungen": "Schon {anzahl} Aufgaben richtig gelöst.",
    "naechster_schritt": "Übe als Nächstes:"
  }'::jsonb,
  check (0 < grenze_minus and grenze_minus < grenze_o and grenze_o < grenze_plus
         and grenze_plus < grenze_plusplus and grenze_plusplus <= 100)
);

alter table public.einstellungen enable row level security;
revoke all on public.einstellungen from anon;
create policy "Lehrkraft: eigene Einstellungen" on public.einstellungen
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

-- Jede Lehrkraft bekommt automatisch Einstellungen mit den Standardwerten.
insert into public.einstellungen (owner) select id from auth.users on conflict do nothing;

create function public.einstellungen_anlegen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.einstellungen (owner) values (new.id) on conflict do nothing;
  return new;
end
$$;
create trigger einstellungen_fuer_neue_lehrkraft
  after insert on auth.users
  for each row execute function public.einstellungen_anlegen();

-- ---------- Hilfsfunktionen ----------

-- Kompetenz-Stufe als Zahl ("6-10" gilt ab Jg. 6)
create function public.stufe_zahl(p_stufe text) returns integer
language sql immutable set search_path = '' as $$
  select case p_stufe when '6' then 6 when '8' then 8 when '10' then 10 when '6-10' then 6 end
$$;

-- Punkte (0–100) → Stufe 0..4
create function public.stufe_aus_punkte(p_punkte numeric, e public.einstellungen) returns integer
language sql immutable set search_path = '' as $$
  select case
    when p_punkte is null then null
    when p_punkte >= e.grenze_plusplus then 4
    when p_punkte >= e.grenze_plus then 3
    when p_punkte >= e.grenze_o then 2
    when p_punkte >= e.grenze_minus then 1
    else 0
  end
$$;

-- Gewertete Versuche einer Person zu einer Kompetenz (pro Aufgabe und Tag nur der erste).
create function public.gewertete_versuche(p_schueler uuid, p_kompetenz uuid, e public.einstellungen)
returns table (bearbeitet_am timestamptz, punkte numeric)
language sql stable set search_path = '' as $$
  select x.bearbeitet_am, x.anteil_richtig * case x.schwierigkeit
      when 'leicht' then e.punkte_leicht when 'mittel' then e.punkte_mittel else e.punkte_schwer end
  from (
    select distinct on (v.aufgabe_id, (v.bearbeitet_am at time zone 'Europe/Berlin')::date)
      v.bearbeitet_am, v.anteil_richtig, a.schwierigkeit
    from public.versuche v
    join public.aufgaben a on a.id = v.aufgabe_id
    join public.aufgabe_kompetenzen ak on ak.aufgabe_id = v.aufgabe_id and ak.kompetenz_id = p_kompetenz
    where v.schueler_id = p_schueler and v.zaehlt_fuer_lernstand
    order by v.aufgabe_id, (v.bearbeitet_am at time zone 'Europe/Berlin')::date, v.bearbeitet_am
  ) x
$$;

-- Stand zu einem Zeitpunkt: gewichteter Durchschnitt der letzten N gewerteten Versuche bis p_bis.
create function public.stand_bis(p_versuche jsonb, p_bis timestamptz, e public.einstellungen)
returns table (punkte numeric, anzahl integer)
language sql immutable set search_path = '' as $$
  with bisher as (
    select (v ->> 'zeit')::timestamptz as zeit, (v ->> 'punkte')::numeric as punkte
    from jsonb_array_elements(p_versuche) v
    where (v ->> 'zeit')::timestamptz <= p_bis
  ),
  letzte as (
    select punkte, row_number() over (order by zeit desc) as nr
    from bisher
    order by zeit desc
    limit e.anzahl_letzte
  )
  select
    case when (select count(*) from bisher) >= e.min_versuche
      then round(sum(punkte * power(e.abklingen, nr - 1)) / sum(power(e.abklingen, nr - 1)), 1)
    end,
    (select count(*) from bisher)::integer
  from letzte
$$;

-- Vollständige Auswertung einer Person zu einer Kompetenz (nur für interne Nutzung).
create function public.auswertung(p_schueler uuid, p_kompetenz uuid, e public.einstellungen) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_versuche jsonb;
  v_jetzt record;
  v_start_zeit timestamptz;
  v_start_punkte numeric;
  v_vgl_zeit timestamptz;
  v_vgl_punkte numeric;
  v_vgl_anzahl integer;
  v_stufe integer;
  v_vgl_stufe integer;
  v_gueltig boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object('zeit', g.bearbeitet_am, 'punkte', g.punkte) order by g.bearbeitet_am), '[]')
  into v_versuche
  from public.gewertete_versuche(p_schueler, p_kompetenz, e) g;

  select * into v_jetzt from public.stand_bis(v_versuche, now(), e);
  if v_jetzt.anzahl = 0 then
    return null;
  end if;
  v_stufe := public.stufe_aus_punkte(v_jetzt.punkte, e);

  -- Startstand: sobald zum ersten Mal genug Versuche da waren
  v_start_zeit := (v_versuche -> (e.min_versuche - 1) ->> 'zeit')::timestamptz;
  if v_start_zeit is not null then
    select s.punkte into v_start_punkte from public.stand_bis(v_versuche, v_start_zeit, e) s;
  end if;

  -- Vergleichsstand: Startstand oder Stand vor X Wochen (falls es den schon gab)
  v_vgl_zeit := v_start_zeit;
  if e.vergleich_wochen is not null and v_start_zeit is not null
     and now() - make_interval(weeks => e.vergleich_wochen) > v_start_zeit then
    v_vgl_zeit := now() - make_interval(weeks => e.vergleich_wochen);
  end if;
  if v_vgl_zeit is not null then
    select s.punkte, s.anzahl into v_vgl_punkte, v_vgl_anzahl from public.stand_bis(v_versuche, v_vgl_zeit, e) s;
    v_vgl_stufe := public.stufe_aus_punkte(v_vgl_punkte, e);
  end if;

  v_gueltig := v_vgl_zeit is not null
    and v_jetzt.anzahl - v_vgl_anzahl >= e.trend_min_neue
    and abs(v_jetzt.punkte - v_vgl_punkte) >= e.trend_min_diff;

  return jsonb_build_object(
    'punkte', v_jetzt.punkte,
    'stufe', v_stufe,
    'anzahl', v_jetzt.anzahl,
    'start_punkte', v_start_punkte,
    'start_stufe', public.stufe_aus_punkte(v_start_punkte, e),
    'start_zeit', v_start_zeit,
    'vergleich_punkte', v_vgl_punkte,
    'vergleich_stufe', v_vgl_stufe,
    'vergleich_zeit', v_vgl_zeit,
    'neue_seit_vergleich', v_jetzt.anzahl - v_vgl_anzahl,
    'trend_gueltig', coalesce(v_gueltig, false),
    'trend_punkte', case when v_gueltig then v_jetzt.punkte - v_vgl_punkte end, -- (korrigiert in 20261107150100)
    'trend_stufen', case when v_gueltig then v_stufe - v_vgl_stufe end,
    'verlauf', (
      select jsonb_agg(jsonb_build_object('zeit', v ->> 'zeit', 'punkte', s.punkte) order by n)
      from jsonb_array_elements(v_versuche) with ordinality x (v, n)
      cross join lateral public.stand_bis(v_versuche, (v ->> 'zeit')::timestamptz, e) s
      where s.punkte is not null
    )
  );
end
$$;

-- ---------- Für Lehrkräfte ----------

-- Lernstand aller Schüler:innen einer Klasse (nur Kompetenzen des eigenen KC mit Daten).
-- Läuft mit den Rechten der Lehrkraft: Die Zugriffsregeln sorgen dafür, dass nur eigene Daten erscheinen.
create function public.lernstand_klasse(p_klasse uuid)
returns table (schueler_id uuid, kompetenz_id uuid, daten jsonb)
language plpgsql stable set search_path = '' as $$
declare
  e public.einstellungen;
begin
  select * into e from public.einstellungen where owner = (select auth.uid());
  if not found then
    return;
  end if;
  return query
    select p.schueler_id, p.kompetenz_id, public.auswertung(p.schueler_id, p.kompetenz_id, e)
    from (
      select distinct s.id as schueler_id, k.id as kompetenz_id
      from public.schueler s
      join public.versuche v on v.schueler_id = s.id
      join public.aufgabe_kompetenzen ak on ak.aufgabe_id = v.aufgabe_id
      join public.kompetenzen k on k.id = ak.kompetenz_id and k.kerncurriculum = s.kerncurriculum
      where s.klasse_id = p_klasse
    ) p;
end
$$;

-- Lernstand einer einzelnen Person (für die Einzelansicht).
create function public.lernstand_schueler(p_schueler uuid)
returns table (kompetenz_id uuid, daten jsonb)
language plpgsql stable set search_path = '' as $$
declare
  e public.einstellungen;
begin
  select * into e from public.einstellungen where owner = (select auth.uid());
  if not found then
    return;
  end if;
  return query
    select p.kompetenz_id, public.auswertung(p_schueler, p.kompetenz_id, e)
    from (
      select distinct k.id as kompetenz_id
      from public.schueler s
      join public.versuche v on v.schueler_id = s.id
      join public.aufgabe_kompetenzen ak on ak.aufgabe_id = v.aufgabe_id
      join public.kompetenzen k on k.id = ak.kompetenz_id and k.kerncurriculum = s.kerncurriculum
      where s.id = p_schueler
    ) p;
end
$$;

-- ---------- Für Schüler:innen: NUR Entwicklung, keine absoluten Stände ----------

create function public.schueler_entwicklung(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.schueler := public.schueler_zum_token(p_token);
  e public.einstellungen;
  v_eintraege jsonb := '[]'::jsonb;
  v_naechster text;
  v_tiefste numeric;
  r record;
  a jsonb;
  v_kategorie text;
begin
  select * into e from public.einstellungen where owner = v_s.owner;
  if v_s.kerncurriculum is null or e.owner is null then
    return jsonb_build_object('kompetenzen', '[]'::jsonb, 'texte', coalesce(e.texte, '{}'::jsonb), 'naechster_schritt', null);
  end if;

  for r in
    select k.id, coalesce(nullif(btrim(k.kurzname), ''), k.bereich) as name, k.bereich, k.sortierung,
      (select count(distinct v.aufgabe_id) from public.versuche v
         join public.aufgabe_kompetenzen ak2 on ak2.aufgabe_id = v.aufgabe_id and ak2.kompetenz_id = k.id
         where v.schueler_id = v_s.id and v.richtig) as geloest
    from public.kompetenzen k
    where k.owner = v_s.owner and k.kerncurriculum = v_s.kerncurriculum and not k.ausgeblendet
      and exists (
        select 1 from public.versuche v
        join public.aufgabe_kompetenzen ak on ak.aufgabe_id = v.aufgabe_id and ak.kompetenz_id = k.id
        where v.schueler_id = v_s.id
      )
    order by k.sortierung
  loop
    a := public.auswertung(v_s.id, r.id, e);
    v_kategorie := case
      when a is null or (a ->> 'punkte') is null or not (a ->> 'trend_gueltig')::boolean
           and coalesce((a ->> 'neue_seit_vergleich')::int, 0) < e.trend_min_neue then 'erste'
      when (a ->> 'trend_gueltig')::boolean and (a ->> 'trend_punkte')::numeric > 0
           and (a ->> 'trend_stufen')::int >= 2 then 'deutlich'
      when (a ->> 'trend_gueltig')::boolean and (a ->> 'trend_punkte')::numeric > 0 then 'besser'
      else 'dranbleiben'
    end;
    -- Nur Name, Bereich, Kategorie und Anzahl gelöster Aufgaben – KEINE Punkte, KEINE Stufen.
    v_eintraege := v_eintraege || jsonb_build_object(
      'name', r.name, 'bereich', r.bereich, 'kategorie', v_kategorie, 'geloest', r.geloest
    );
    -- Vorschlag für den nächsten Schritt: Kompetenz mit dem niedrigsten Stand (nur unterhalb von "+")
    if (a ->> 'punkte') is not null and (a ->> 'punkte')::numeric < e.grenze_plus
       and (v_tiefste is null or (a ->> 'punkte')::numeric < v_tiefste) then
      v_tiefste := (a ->> 'punkte')::numeric;
      v_naechster := r.name;
    end if;
  end loop;

  return jsonb_build_object('kompetenzen', v_eintraege, 'texte', e.texte, 'naechster_schritt', v_naechster);
end
$$;

-- ---------- Rechte ----------

revoke execute on all functions in schema public from public, anon, authenticated;

-- Schüler:innen
grant execute on function public.schueler_start(text) to anon, authenticated;
grant execute on function public.antwort_abgeben(text, uuid, uuid, jsonb, uuid, timestamptz) to anon, authenticated;
grant execute on function public.loesung_anzeigen(text, uuid, uuid) to anon, authenticated;
grant execute on function public.schueler_entwicklung(text) to anon, authenticated;

-- Lehrkräfte
grant execute on function public.neuer_token() to authenticated;
grant execute on function public.normalisiere(text, boolean) to authenticated;
grant execute on function public.pruefe_aufgabe(text, jsonb, jsonb) to authenticated;
grant execute on function public.lernstand_klasse(uuid) to authenticated;
grant execute on function public.lernstand_schueler(uuid) to authenticated;
grant execute on function public.auswertung(uuid, uuid, public.einstellungen) to authenticated;
grant execute on function public.gewertete_versuche(uuid, uuid, public.einstellungen) to authenticated;
grant execute on function public.stand_bis(jsonb, timestamptz, public.einstellungen) to authenticated;
grant execute on function public.stufe_aus_punkte(numeric, public.einstellungen) to authenticated;
grant execute on function public.stufe_zahl(text) to authenticated;
