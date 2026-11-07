-- =====================================================================
-- Etappe 1: Grundtabellen, Zugriffsregeln und Schüler-Funktionen
-- =====================================================================
-- Grundsätze:
-- * Jede Lehrkraft sieht nur Zeilen, deren "owner" sie selbst ist.
-- * Schüler:innen haben kein Konto. Sie kommen NICHT direkt an die Tabellen,
--   sondern nur über die Funktionen schueler_start, antwort_abgeben und
--   loesung_anzeigen. Diese prüfen den Link-Token und geben nur eigene Daten
--   heraus – ohne Lösungen.
-- * Antworten werden in der Datenbank geprüft. So kann niemand ein
--   "richtig" vortäuschen, und Lösungen verlassen die Datenbank erst,
--   wenn sie angezeigt werden dürfen.

create extension if not exists pgcrypto with schema extensions;

-- Neue Funktionen darf standardmäßig niemand aufrufen; Rechte werden unten einzeln vergeben.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------

-- Zufälliger Link-Token: 24 Byte = 192 Bit, URL-tauglich (32 Zeichen).
create function public.neuer_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
$$;

-- Vereinheitlicht eine Eingabe vor dem Vergleich:
-- Unicode vereinheitlichen, Apostroph-Varianten angleichen, Leerzeichen zusammenfassen,
-- bei Bedarf Groß-/Kleinschreibung ignorieren.
create function public.normalisiere(p_text text, p_gross_klein_beachten boolean) returns text
language sql immutable set search_path = '' as $$
  select case when p_gross_klein_beachten then x else lower(x) end
  from (
    select btrim(regexp_replace(translate(normalize(coalesce(p_text, ''), NFC), '’‘`´', ''''''''''), '\s+', ' ', 'g')) as x
  ) s
$$;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------

create table public.klassen (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  erstellt_am timestamptz not null default now()
);

create table public.schueler (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  klasse_id uuid not null references public.klassen (id) on delete cascade,
  pseudonym text not null check (length(btrim(pseudonym)) between 1 and 40),
  token text not null unique default public.neuer_token() check (length(token) >= 22),
  erstellt_am timestamptz not null default now(),
  unique (klasse_id, pseudonym)
);
create index on public.schueler (owner);

create table public.aufgaben (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  typ text not null check (typ in ('lueckentext')),
  titel text not null check (length(btrim(titel)) between 1 and 120),
  anweisung text not null default '',
  hinweis text,
  rueckmeldung_fehler text,
  schwierigkeit text not null default 'mittel' check (schwierigkeit in ('leicht', 'mittel', 'schwer')),
  inhalt jsonb not null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
create index on public.aufgaben (owner);

create table public.pakete (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titel text not null check (length(btrim(titel)) between 1 and 120),
  beschreibung text,
  erstellt_am timestamptz not null default now()
);
create index on public.pakete (owner);

create table public.paket_aufgaben (
  paket_id uuid not null references public.pakete (id) on delete cascade,
  aufgabe_id uuid not null references public.aufgaben (id) on delete cascade,
  position integer not null default 0,
  primary key (paket_id, aufgabe_id)
);
create index on public.paket_aufgaben (aufgabe_id);

-- Ein Paket wird entweder einer ganzen Klasse ODER einer einzelnen Schülerin/einem Schüler zugewiesen.
create table public.zuweisungen (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paket_id uuid not null references public.pakete (id) on delete cascade,
  klasse_id uuid references public.klassen (id) on delete cascade,
  schueler_id uuid references public.schueler (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  check ((klasse_id is null) <> (schueler_id is null))
);
create unique index on public.zuweisungen (paket_id, klasse_id) where klasse_id is not null;
create unique index on public.zuweisungen (paket_id, schueler_id) where schueler_id is not null;
create index on public.zuweisungen (klasse_id);
create index on public.zuweisungen (schueler_id);

-- Jeder Versuch wird gespeichert. client_id verhindert doppeltes Speichern,
-- wenn ein Versuch bei wackligem WLAN zweimal gesendet wird.
create table public.versuche (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  schueler_id uuid not null references public.schueler (id) on delete cascade,
  aufgabe_id uuid not null references public.aufgaben (id) on delete cascade,
  paket_id uuid references public.pakete (id) on delete set null,
  antworten jsonb not null,
  ergebnis jsonb not null,
  anteil_richtig numeric(4, 3) not null,
  richtig boolean not null,
  -- false, wenn vorher die Lösung angesehen wurde (zählt dann nicht für den Lernstand)
  zaehlt_fuer_lernstand boolean not null default true,
  bearbeitet_am timestamptz not null default now(),
  gespeichert_am timestamptz not null default now()
);
create index on public.versuche (schueler_id, aufgabe_id);

create table public.loesung_angesehen (
  schueler_id uuid not null references public.schueler (id) on delete cascade,
  aufgabe_id uuid not null references public.aufgaben (id) on delete cascade,
  angesehen_am timestamptz not null default now(),
  primary key (schueler_id, aufgabe_id)
);

-- ---------------------------------------------------------------------
-- Zugriffsregeln (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.klassen enable row level security;
alter table public.schueler enable row level security;
alter table public.aufgaben enable row level security;
alter table public.pakete enable row level security;
alter table public.paket_aufgaben enable row level security;
alter table public.zuweisungen enable row level security;
alter table public.versuche enable row level security;
alter table public.loesung_angesehen enable row level security;

-- Nicht angemeldete Besucher (also auch Schüler:innen) dürfen an keine Tabelle direkt heran.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
-- Versuche schreibt nur die Datenbank selbst (über antwort_abgeben); Lehrkräfte lesen sie nur.
revoke insert, update on public.versuche, public.loesung_angesehen from authenticated;

create policy "Lehrkraft: eigene Klassen" on public.klassen
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "Lehrkraft: eigene Schüler:innen" on public.schueler
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (
    owner = (select auth.uid())
    and exists (select 1 from public.klassen k where k.id = klasse_id and k.owner = (select auth.uid()))
  );

create policy "Lehrkraft: eigene Aufgaben" on public.aufgaben
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "Lehrkraft: eigene Pakete" on public.pakete
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "Lehrkraft: Aufgaben in eigenen Paketen" on public.paket_aufgaben
  for all to authenticated
  using (exists (select 1 from public.pakete p where p.id = paket_id and p.owner = (select auth.uid())))
  with check (
    exists (select 1 from public.pakete p where p.id = paket_id and p.owner = (select auth.uid()))
    and exists (select 1 from public.aufgaben a where a.id = aufgabe_id and a.owner = (select auth.uid()))
  );

create policy "Lehrkraft: eigene Zuweisungen" on public.zuweisungen
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (
    owner = (select auth.uid())
    and exists (select 1 from public.pakete p where p.id = paket_id and p.owner = (select auth.uid()))
    and (
      exists (select 1 from public.klassen k where k.id = klasse_id and k.owner = (select auth.uid()))
      or exists (select 1 from public.schueler s where s.id = schueler_id and s.owner = (select auth.uid()))
    )
  );

create policy "Lehrkraft: Versuche eigener Schüler:innen lesen" on public.versuche
  for select to authenticated
  using (exists (select 1 from public.schueler s where s.id = schueler_id and s.owner = (select auth.uid())));

create policy "Lehrkraft: Versuche eigener Schüler:innen löschen" on public.versuche
  for delete to authenticated
  using (exists (select 1 from public.schueler s where s.id = schueler_id and s.owner = (select auth.uid())));

create policy "Lehrkraft: angesehene Lösungen lesen" on public.loesung_angesehen
  for select to authenticated
  using (exists (select 1 from public.schueler s where s.id = schueler_id and s.owner = (select auth.uid())));

-- ---------------------------------------------------------------------
-- Aufgaben prüfen (gleiche Logik für Schüler:innen und die Vorschau der Lehrkraft)
-- ---------------------------------------------------------------------

-- p_antworten: Objekt { "<Lücken-Nummer>": "<Eingabe>" }
-- Ergebnis: { luecken: [{id, richtig}], anteil: 0..1, richtig: true/false }
create function public.pruefe_aufgabe(p_typ text, p_inhalt jsonb, p_antworten jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_teil jsonb;
  v_eingabe text;
  v_ok boolean;
  v_luecken jsonb := '[]'::jsonb;
  v_anzahl integer := 0;
  v_richtig integer := 0;
  v_gk boolean := coalesce((p_inhalt ->> 'gross_klein_beachten')::boolean, true);
begin
  if p_typ = 'lueckentext' then
    for v_teil in select t from jsonb_array_elements(p_inhalt -> 'teile') t loop
      continue when v_teil ->> 't' is distinct from 'luecke';
      v_anzahl := v_anzahl + 1;
      v_eingabe := public.normalisiere(p_antworten ->> (v_teil ->> 'id'), v_gk);
      select v_eingabe <> '' and exists (
        select 1 from jsonb_array_elements_text(v_teil -> 'loesungen') l
        where public.normalisiere(l, v_gk) = v_eingabe
      ) into v_ok;
      if v_ok then
        v_richtig := v_richtig + 1;
      end if;
      v_luecken := v_luecken || jsonb_build_object('id', v_teil -> 'id', 'richtig', v_ok);
    end loop;
  else
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;

  return jsonb_build_object(
    'luecken', v_luecken,
    'anteil', case when v_anzahl = 0 then 0 else round(v_richtig::numeric / v_anzahl, 3) end,
    'richtig', v_anzahl > 0 and v_richtig = v_anzahl
  );
end
$$;

-- Aufgabeninhalt OHNE Lösungen (für Schüler:innen).
create function public.inhalt_ohne_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ = 'lueckentext' then
    -- Achtung: Das Feld "text" (Eingabetext der Lehrkraft) enthält die Lösungen und wird bewusst weggelassen.
    return jsonb_build_object(
      'teile', coalesce((
        select jsonb_agg(t - 'loesungen' order by nr)
        from jsonb_array_elements(p_inhalt -> 'teile') with ordinality e (t, nr)
      ), '[]'::jsonb)
    );
  end if;
  raise exception 'Unbekannter Aufgabentyp: %', p_typ;
end
$$;

-- Nur die Lösungen einer Aufgabe.
create function public.nur_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ = 'lueckentext' then
    return jsonb_build_object(
      'luecken', coalesce((
        select jsonb_agg(jsonb_build_object('id', t -> 'id', 'loesungen', t -> 'loesungen'))
        from jsonb_array_elements(p_inhalt -> 'teile') t
        where t ->> 't' = 'luecke'
      ), '[]'::jsonb)
    );
  end if;
  raise exception 'Unbekannter Aufgabentyp: %', p_typ;
end
$$;

-- ---------------------------------------------------------------------
-- Funktionen für Schüler:innen (Zugriff nur mit gültigem Link-Token)
-- ---------------------------------------------------------------------

-- Sucht die Schülerin/den Schüler zum Token. Fehler, wenn der Token ungültig ist.
create function public.schueler_zum_token(p_token text) returns public.schueler
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s public.schueler;
begin
  select * into v_s from public.schueler where token = p_token;
  if not found or p_token is null then
    raise exception 'Dieser Link ist nicht (mehr) gültig.' using errcode = 'P0002';
  end if;
  return v_s;
end
$$;

-- Liefert die Aufgabe, wenn sie im Paket liegt und das Paket der Person zugewiesen ist.
create function public.zugewiesene_aufgabe(p_s public.schueler, p_paket_id uuid, p_aufgabe_id uuid) returns public.aufgaben
language plpgsql stable security definer set search_path = '' as $$
declare
  v_a public.aufgaben;
begin
  select a.* into v_a
  from public.aufgaben a
  join public.paket_aufgaben pa on pa.aufgabe_id = a.id
  where a.id = p_aufgabe_id
    and pa.paket_id = p_paket_id
    and exists (
      select 1 from public.zuweisungen z
      where z.paket_id = p_paket_id
        and (z.schueler_id = p_s.id or z.klasse_id = p_s.klasse_id)
    );
  if not found then
    raise exception 'Diese Aufgabe ist dir nicht zugewiesen.' using errcode = 'P0002';
  end if;
  return v_a;
end
$$;

-- Startseite: Pseudonym, zugewiesene Pakete und Aufgaben (ohne Lösungen) mit eigenem Bearbeitungsstand.
create function public.schueler_start(p_token text) returns jsonb
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
                'schwierigkeit', a.schwierigkeit,
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

-- Antwort abgeben: wird geprüft und als Versuch gespeichert.
create function public.antwort_abgeben(
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

  -- Wurde dieser Versuch schon gespeichert (doppelt gesendet)? Dann das alte Ergebnis zurückgeben.
  select * into v_v from public.versuche where client_id = p_client_id and schueler_id = v_s.id;

  if not found then
    v_erg := public.pruefe_aufgabe(v_a.typ, v_a.inhalt, p_antworten);
    insert into public.versuche (
      client_id, schueler_id, aufgabe_id, paket_id, antworten, ergebnis,
      anteil_richtig, richtig, zaehlt_fuer_lernstand, bearbeitet_am
    ) values (
      p_client_id, v_s.id, v_a.id, p_paket_id, p_antworten, v_erg,
      (v_erg ->> 'anteil')::numeric, (v_erg ->> 'richtig')::boolean,
      not exists (select 1 from public.loesung_angesehen l where l.schueler_id = v_s.id and l.aufgabe_id = v_a.id),
      -- Zeitpunkt vom iPad (falls offline bearbeitet), aber nie in der Zukunft und höchstens 14 Tage zurück
      greatest(least(coalesce(p_bearbeitet_am, now()), now()), now() - interval '14 days')
    )
    returning * into v_v;
  end if;

  return jsonb_build_object(
    'ergebnis', v_v.ergebnis,
    'rueckmeldung', case when v_v.richtig then null else v_a.rueckmeldung_fehler end,
    'versuche', (select count(*) from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = v_a.id)
  );
end
$$;

-- Lösung ansehen: erst nach mindestens 2 Versuchen. Danach zählen weitere Versuche nicht für den Lernstand.
create function public.loesung_anzeigen(p_token text, p_paket_id uuid, p_aufgabe_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_s public.schueler := public.schueler_zum_token(p_token);
  v_a public.aufgaben := public.zugewiesene_aufgabe(v_s, p_paket_id, p_aufgabe_id);
begin
  if (select count(*) from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = v_a.id) < 2 then
    raise exception 'Die Lösung gibt es erst nach zwei Versuchen.' using errcode = 'P0001';
  end if;
  insert into public.loesung_angesehen (schueler_id, aufgabe_id)
  values (v_s.id, v_a.id)
  on conflict do nothing;
  return public.nur_loesung(v_a.typ, v_a.inhalt);
end
$$;

-- ---------------------------------------------------------------------
-- Rechte für Funktionen
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

-- Schüler:innen (nicht angemeldet) dürfen nur diese drei Funktionen aufrufen:
grant execute on function public.schueler_start(text) to anon, authenticated;
grant execute on function public.antwort_abgeben(text, uuid, uuid, jsonb, uuid, timestamptz) to anon, authenticated;
grant execute on function public.loesung_anzeigen(text, uuid, uuid) to anon, authenticated;

-- Lehrkräfte: Token erzeugen (Standardwert beim Anlegen) und Aufgaben in der Vorschau prüfen.
grant execute on function public.neuer_token() to authenticated;
grant execute on function public.normalisiere(text, boolean) to authenticated;
grant execute on function public.pruefe_aufgabe(text, jsonb, jsonb) to authenticated;
