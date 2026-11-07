-- =====================================================================
-- Blumenwiese auf der Startseite der Schüler:innen
-- =====================================================================
-- * Die Blumenzahl entsteht aus der ENTWICKLUNG (Kategorien aus schueler_entwicklung) und aus abgeschlossenen
--   Übungspaketen – nie aus dem absoluten Niveau (-- bis ++).
-- * Die Wiese welkt nie: gespeichert wird der Höchststand (schueler.wiese_blumen), er wird nur erhöht.
-- * Der Schüler-Link bekommt über schueler_wiese NUR diese eine Zahl.

alter table public.schueler
  add column wiese_blumen integer not null default 0 check (wiese_blumen between 0 and 80);

-- Einstellbar durch die Lehrkraft (Voreinstellung wie im Design-System vorgeschlagen)
alter table public.einstellungen
  add column wiese_sammeln integer not null default 0 check (wiese_sammeln between 0 and 10),
  add column wiese_dran integer not null default 1 check (wiese_dran between 0 and 10),
  add column wiese_gut integer not null default 2 check (wiese_gut between 0 and 10),
  add column wiese_stark integer not null default 3 check (wiese_stark between 0 and 10),
  add column wiese_je_paket integer not null default 1 check (wiese_je_paket between 0 and 10),
  add column wiese_pakete_max integer not null default 20 check (wiese_pakete_max between 0 and 80);

-- Reine Rechenregel (ohne Datenbankzugriff, damit sie sich leicht testen lässt). Obergrenze 80.
create function public.wiese_zahl(
  p_stark integer, p_gut integer, p_dran integer, p_sammeln integer, p_pakete integer, e public.einstellungen
) returns integer
language sql immutable set search_path = '' as $$
  select least(80, greatest(0,
    p_stark * e.wiese_stark + p_gut * e.wiese_gut + p_dran * e.wiese_dran + p_sammeln * e.wiese_sammeln
    + least(e.wiese_pakete_max, p_pakete * e.wiese_je_paket)))
$$;

-- Für den Schüler-Link: berechnet die Blumenzahl, erhöht den gespeicherten Höchststand und gibt NUR ihn zurück.
create function public.schueler_wiese(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_s public.schueler := public.schueler_zum_token(p_token);
  e public.einstellungen;
  v_kat jsonb;
  v_pakete integer;
  v_neu integer;
  v_blumen integer;
begin
  select * into e from public.einstellungen where owner = v_s.owner;
  if e.owner is null then
    return jsonb_build_object('blumen', v_s.wiese_blumen);
  end if;

  -- Entwicklungskategorien (dieselben, die die Schüler:innen auch als Kacheln sehen)
  v_kat := public.schueler_entwicklung(p_token) -> 'kompetenzen';

  -- Abgeschlossene Pakete: zugewiesen, mindestens eine Aufgabe, alle Aufgaben mindestens einmal richtig gelöst
  select count(*) into v_pakete
  from public.pakete p
  where exists (select 1 from public.zuweisungen z
                where z.paket_id = p.id and (z.schueler_id = v_s.id or z.klasse_id = v_s.klasse_id))
    and exists (select 1 from public.paket_aufgaben pa where pa.paket_id = p.id)
    and not exists (
      select 1 from public.paket_aufgaben pa
      where pa.paket_id = p.id
        and not exists (select 1 from public.versuche v
                        where v.schueler_id = v_s.id and v.aufgabe_id = pa.aufgabe_id and v.richtig));

  v_neu := public.wiese_zahl(
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'deutlich'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'besser'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'dranbleiben'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'erste'),
    v_pakete, e);

  -- Nur erhöhen, nie senken
  update public.schueler set wiese_blumen = greatest(wiese_blumen, v_neu)
  where id = v_s.id
  returning wiese_blumen into v_blumen;

  return jsonb_build_object('blumen', v_blumen);
end
$$;

revoke execute on function public.wiese_zahl(integer, integer, integer, integer, integer, public.einstellungen),
  public.schueler_wiese(text) from public, anon, authenticated;
grant execute on function public.schueler_wiese(text) to anon, authenticated;
grant execute on function public.wiese_zahl(integer, integer, integer, integer, integer, public.einstellungen) to authenticated;
