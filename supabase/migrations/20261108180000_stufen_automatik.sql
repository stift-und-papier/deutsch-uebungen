-- =====================================================================
-- Stufen pro Schüler:in: automatischer Aufstieg je Themenbereich, manuelle Stufe hat Vorrang
-- =====================================================================
-- * Aufgaben behalten intern schwierigkeit = leicht/mittel/schwer (= Stufe 1/2/3, siehe stufe_nr) –
--   so bleiben alle gespeicherten Aufgaben und die Lernstand-Berechnung unverändert.
-- * schueler.stufe_manuell: 1–3 = von der Lehrkraft gesetzt (gilt für alle Bereiche), null = automatisch.
-- * schueler_stufen: automatische Stufe je Themenbereich (kompetenzen.bereich). Startet bei 1 (= kein Eintrag),
--   steigt nur, sinkt nie. Aktualisiert nach jeder Abgabe (antwort_abgeben).
-- * Schüler:innen sehen je Paket und Bereich nur die Aufgaben ihrer Stufe (sichtbare_aufgaben).

-- ---------- REGEL FÜR DEN AUFSTIEG: hier und nur hier ändern ----------
-- Aufstieg auf die nächste Stufe, wenn in einem Bereich mindestens PROZENT der bearbeiteten Aufgaben
-- dieser Stufe im ERSTEN Versuch richtig gelöst wurden – bei mindestens MINDESTENS bearbeiteten Aufgaben.
create function public.stufen_regel(out prozent integer, out mindestens integer)
language sql immutable set search_path = '' as $$
  select 80, 5
$$;

-- Reine Rechenregel (ohne Datenbankzugriff, leicht zu testen)
create function public.stufe_aufstieg(p_bearbeitet integer, p_richtig integer) returns boolean
language sql immutable set search_path = '' as $$
  select p_bearbeitet >= r.mindestens and p_richtig * 100 >= r.prozent * p_bearbeitet
  from public.stufen_regel() r
$$;

-- Interner Wert der Aufgabe → Stufe 1/2/3
create function public.stufe_nr(p_schwierigkeit text) returns integer
language sql immutable set search_path = '' as $$
  select case p_schwierigkeit when 'leicht' then 1 when 'schwer' then 3 else 2 end
$$;

alter table public.schueler
  add column stufe_manuell smallint check (stufe_manuell between 1 and 3);

create table public.schueler_stufen (
  schueler_id uuid not null references public.schueler (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  bereich text not null,
  stufe smallint not null check (stufe between 1 and 3),
  geaendert_am timestamptz not null default now(),
  primary key (schueler_id, bereich)
);
create index on public.schueler_stufen (owner);
alter table public.schueler_stufen enable row level security;
revoke all on public.schueler_stufen from anon;
-- Lehrkraft liest die Stufen ihrer Schüler:innen; geschrieben wird nur von der Datenbank selbst
revoke insert, update, delete on public.schueler_stufen from authenticated;
create policy "Lehrkraft: Stufen eigener Schüler:innen lesen" on public.schueler_stufen
  for select to authenticated using (owner = (select auth.uid()));

-- Themenbereich einer Aufgabe für eine Schüler:in: Bereich der zugeordneten Kompetenz im eigenen KC
-- (sonst irgendeine zugeordnete Kompetenz; ohne Kompetenz '' = eigene Gruppe „ohne Bereich“).
-- shortcut: bei Kompetenzen aus mehreren Bereichen zählt der alphabetisch erste; reicht, solange Aufgaben einem Thema dienen
create function public.aufgabe_bereich(p_aufgabe uuid, p_kc text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select min(k.bereich) from public.aufgabe_kompetenzen ak join public.kompetenzen k on k.id = ak.kompetenz_id
     where ak.aufgabe_id = p_aufgabe and k.kerncurriculum = p_kc),
    (select min(k.bereich) from public.aufgabe_kompetenzen ak join public.kompetenzen k on k.id = ak.kompetenz_id
     where ak.aufgabe_id = p_aufgabe),
    '')
$$;

-- Stufe, auf der eine Schüler:in in einem Bereich arbeitet: manuell vor automatisch, Start = 1
create function public.stufe_fuer(p_s public.schueler, p_bereich text) returns integer
language sql stable set search_path = '' as $$
  select coalesce(p_s.stufe_manuell::int,
    (select st.stufe::int from public.schueler_stufen st where st.schueler_id = p_s.id and st.bereich = p_bereich),
    1)
$$;

-- Automatik: je Bereich so lange aufsteigen, wie die Regel erfüllt ist. Nie zurück (greatest).
create function public.stufen_aktualisieren(p_s public.schueler) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_bereich text;
  v_stufe integer;
  v_bearbeitet integer;
  v_richtig integer;
begin
  for v_bereich in
    select distinct public.aufgabe_bereich(v.aufgabe_id, p_s.kerncurriculum)
    from public.versuche v where v.schueler_id = p_s.id
  loop
    v_stufe := coalesce((select stufe from public.schueler_stufen where schueler_id = p_s.id and bereich = v_bereich), 1);
    while v_stufe < 3 loop
      -- je Aufgabe dieser Stufe und dieses Bereichs: bearbeitet? erster gewerteter Versuch richtig?
      select count(*), count(*) filter (where erster_richtig)
      into v_bearbeitet, v_richtig
      from (
        select (array_agg(v.richtig order by v.bearbeitet_am, v.gespeichert_am))[1] as erster_richtig
        from public.versuche v
        join public.aufgaben a on a.id = v.aufgabe_id
        where v.schueler_id = p_s.id and v.zaehlt_fuer_lernstand and a.typ <> 'erklaerung'
          and public.stufe_nr(a.schwierigkeit) = v_stufe
          and public.aufgabe_bereich(a.id, p_s.kerncurriculum) = v_bereich
        group by v.aufgabe_id
      ) je_aufgabe;
      exit when not public.stufe_aufstieg(v_bearbeitet, v_richtig);
      v_stufe := v_stufe + 1;
    end loop;
    if v_stufe > 1 then
      insert into public.schueler_stufen (schueler_id, owner, bereich, stufe)
      values (p_s.id, p_s.owner, v_bereich, v_stufe)
      on conflict (schueler_id, bereich) do update
        set stufe = greatest(public.schueler_stufen.stufe, excluded.stufe), geaendert_am = now()
        where excluded.stufe > public.schueler_stufen.stufe;
    end if;
  end loop;
end
$$;

-- Aufgaben eines Pakets, die eine Schüler:in sieht: je Bereich die Aufgaben ihrer Stufe. Gibt es im Paket
-- keine auf ihrer Stufe, die nächst niedrigere vorhandene, sonst die niedrigste vorhandene (Paket nie leer).
-- Erklärseiten sieht man immer.
create function public.sichtbare_aufgaben(p_s public.schueler, p_paket uuid) returns setof uuid
language sql stable set search_path = '' as $$
  with t as (
    select a.id, a.typ, public.stufe_nr(a.schwierigkeit) as st, public.aufgabe_bereich(a.id, p_s.kerncurriculum) as b
    from public.paket_aufgaben pa join public.aufgaben a on a.id = pa.aufgabe_id
    where pa.paket_id = p_paket
  ),
  gruppe as (
    select b, coalesce(max(st) filter (where st <= public.stufe_fuer(p_s, b)), min(st)) as gewaehlt
    from t where typ <> 'erklaerung'
    group by b
  )
  select id from t where typ = 'erklaerung'
  union all
  select t.id from t join gruppe g on g.b = t.b where t.typ <> 'erklaerung' and t.st = g.gewaehlt
$$;

revoke execute on function public.stufen_regel(), public.stufe_aufstieg(integer, integer), public.stufe_nr(text),
  public.aufgabe_bereich(uuid, text), public.stufe_fuer(public.schueler, text),
  public.stufen_aktualisieren(public.schueler), public.sichtbare_aufgaben(public.schueler, uuid)
  from public, anon, authenticated;

-- Startseite: nur sichtbare Aufgaben, Stufe als Zahl 1–3 (statt leicht/mittel/schwer)
create or replace function public.schueler_start(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.schueler := public.schueler_zum_token(p_token);
begin
  return jsonb_build_object(
    'pseudonym', v_s.pseudonym,
    'pakete', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'titel', p.titel,
          'beschreibung', p.beschreibung,
          'aufgaben', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'typ', a.typ,
                'titel', a.titel,
                'anweisung', a.anweisung,
                'hinweis', a.hinweis,
                'stufe', public.stufe_nr(a.schwierigkeit),
                'inhalt', public.inhalt_ohne_loesung(a.typ, a.inhalt),
                'versuche', (select count(*) from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = a.id),
                'geloest', exists (select 1 from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = a.id and v.richtig),
                'loesung_angesehen', exists (select 1 from public.loesung_angesehen l where l.schueler_id = v_s.id and l.aufgabe_id = a.id)
              )
              order by pa.position, a.titel
            )
            from public.paket_aufgaben pa
            join public.aufgaben a on a.id = pa.aufgabe_id
            where pa.paket_id = p.id
              and a.id in (select public.sichtbare_aufgaben(v_s, p.id))
          ), '[]'::jsonb)
        )
        order by z.zugewiesen desc
      )
      from public.pakete p
      join lateral (
        select max(zw.erstellt_am) as zugewiesen
        from public.zuweisungen zw
        where zw.paket_id = p.id
          and (zw.schueler_id = v_s.id or zw.klasse_id = v_s.klasse_id)
      ) z on z.zugewiesen is not null
    ), '[]'::jsonb)
  );
end
$$;

-- Antwort abgeben: wie bisher, danach Automatik aktualisieren
create or replace function public.antwort_abgeben(
  p_token text,
  p_paket_id uuid,
  p_aufgabe_id uuid,
  p_antworten jsonb,
  p_client_id uuid,
  p_bearbeitet_am timestamptz default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_s public.schueler := public.schueler_zum_token(p_token);
  v_a public.aufgaben := public.zugewiesene_aufgabe(v_s, p_paket_id, p_aufgabe_id);
  v_v public.versuche;
  v_erg jsonb;
begin
  if p_client_id is null or p_antworten is null or jsonb_typeof(p_antworten) <> 'object'
     or length(p_antworten::text) > 20000 then
    raise exception 'Ungültige Antwort.' using errcode = '22023';
  end if;

  select * into v_v from public.versuche where client_id = p_client_id and schueler_id = v_s.id;

  if not found then
    v_erg := public.pruefe_aufgabe(v_a.typ, v_a.inhalt, p_antworten);
    insert into public.versuche (
      client_id, schueler_id, aufgabe_id, paket_id, antworten, ergebnis,
      anteil_richtig, richtig, zaehlt_fuer_lernstand, bearbeitet_am
    ) values (
      p_client_id, v_s.id, v_a.id, p_paket_id, p_antworten, v_erg,
      (v_erg ->> 'anteil')::numeric, (v_erg ->> 'richtig')::boolean,
      v_a.typ <> 'erklaerung'
        and not exists (select 1 from public.loesung_angesehen l where l.schueler_id = v_s.id and l.aufgabe_id = v_a.id),
      greatest(least(coalesce(p_bearbeitet_am, now()), now()), now() - interval '14 days')
    )
    returning * into v_v;
    perform public.stufen_aktualisieren(v_s);
  end if;

  return jsonb_build_object(
    'ergebnis', v_v.ergebnis,
    'rueckmeldung', case when v_v.richtig then null else v_a.rueckmeldung_fehler end,
    'versuche', (select count(*) from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = v_a.id)
  );
end
$$;

-- Blumenwiese: „Paket abgeschlossen“ = alle für diese Schüler:in sichtbaren Aufgaben gelöst
-- (sonst könnte niemand ein Paket mit Aufgaben anderer Stufen abschließen). Rechenregel unverändert.
create or replace function public.schueler_wiese(p_token text) returns jsonb
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

  v_kat := public.schueler_entwicklung(p_token) -> 'kompetenzen';

  select count(*) into v_pakete
  from public.pakete p
  where exists (select 1 from public.zuweisungen z
                where z.paket_id = p.id and (z.schueler_id = v_s.id or z.klasse_id = v_s.klasse_id))
    and exists (select 1 from public.paket_aufgaben pa where pa.paket_id = p.id)
    and not exists (
      select 1 from public.sichtbare_aufgaben(v_s, p.id) sa (aufgabe_id)
      where not exists (select 1 from public.versuche v
                        where v.schueler_id = v_s.id and v.aufgabe_id = sa.aufgabe_id and v.richtig));

  v_neu := public.wiese_zahl(
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'deutlich'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'besser'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'dranbleiben'),
    (select count(*)::int from jsonb_array_elements(v_kat) k where k ->> 'kategorie' = 'erste'),
    v_pakete, e);

  update public.schueler set wiese_blumen = greatest(wiese_blumen, v_neu)
  where id = v_s.id
  returning wiese_blumen into v_blumen;

  return jsonb_build_object('blumen', v_blumen);
end
$$;
