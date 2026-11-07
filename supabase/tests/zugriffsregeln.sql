-- =====================================================================
-- Test der Zugriffsregeln (läuft gegen die echte Datenbank, ändert aber nichts:
-- am Ende wird absichtlich ein Fehler ausgelöst, damit ALLES rückgängig gemacht wird).
--
-- Ausführen:  npx supabase db query --linked -f supabase/tests/zugriffsregeln.sql
-- Erwartete Ausgabe: Fehlermeldung "ALLE TESTS BESTANDEN (...)".
-- Jede andere Meldung bedeutet: Ein Test ist fehlgeschlagen.
-- =====================================================================
do $test$
declare
  -- Zwei Lehrkräfte A und B mit je einer Klasse; A hat zwei Klassen.
  c_lk_a constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  c_lk_b constant uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  c_kl_a1 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000c1';
  c_kl_a2 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000c2';
  c_kl_b1 constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000c1';
  c_sch_a1 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000e1';
  c_sch_a2 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000e2';
  c_sch_b1 constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000e1';
  c_tok_a1 constant text := 'TEST_token_a1_xxxxxxxxxxxxxxxxxxxxxxx';
  c_tok_a2 constant text := 'TEST_token_a2_xxxxxxxxxxxxxxxxxxxxxxx';
  c_tok_b1 constant text := 'TEST_token_b1_xxxxxxxxxxxxxxxxxxxxxxx';
  c_auf_a constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000a1';
  c_auf_a2 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000a2';
  c_auf_b constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000a1';
  c_pak_a1 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000b1';
  c_pak_a2 constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000b2';
  c_pak_b constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000b1';
  c_kom_a constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000d1';
  c_kom_b constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000d1';
  c_inhalt constant jsonb := '{"text":"Ich weiß, [dass] du kommst.","gross_klein_beachten":true,"teile":[{"t":"text","v":"Ich weiß, "},{"t":"luecke","id":0,"loesungen":["dass"]},{"t":"text","v":" du kommst."}]}';
  v jsonb;
  n bigint;
  ok text[] := '{}';
begin
  -- ---------- Testdaten (als Datenbank-Verwalter, umgeht die Regeln) ----------
  insert into auth.users (id, aud, role, email) values
    (c_lk_a, 'authenticated', 'authenticated', 'test-a@example.invalid'),
    (c_lk_b, 'authenticated', 'authenticated', 'test-b@example.invalid');
  insert into public.klassen (id, owner, name) values
    (c_kl_a1, c_lk_a, 'A 7a'), (c_kl_a2, c_lk_a, 'A 8b'), (c_kl_b1, c_lk_b, 'B 7c');
  insert into public.schueler (id, owner, klasse_id, pseudonym, token) values
    (c_sch_a1, c_lk_a, c_kl_a1, 'Fuchs-01', c_tok_a1),
    (c_sch_a2, c_lk_a, c_kl_a2, 'Eule-02', c_tok_a2),
    (c_sch_b1, c_lk_b, c_kl_b1, 'Dachs-03', c_tok_b1);
  insert into public.aufgaben (id, owner, typ, titel, inhalt, rueckmeldung_fehler) values
    (c_auf_a, c_lk_a, 'lueckentext', 'dass/das A', c_inhalt, 'Probier die Ersatzprobe mit "dieses".'),
    (c_auf_a2, c_lk_a, 'lueckentext', 'nur Klasse 8b', c_inhalt, null),
    (c_auf_b, c_lk_b, 'lueckentext', 'dass/das B', c_inhalt, null);
  insert into public.pakete (id, owner, titel) values
    (c_pak_a1, c_lk_a, 'Paket A1'), (c_pak_a2, c_lk_a, 'Paket A2'), (c_pak_b, c_lk_b, 'Paket B');
  insert into public.paket_aufgaben (paket_id, aufgabe_id) values
    (c_pak_a1, c_auf_a), (c_pak_a2, c_auf_a2), (c_pak_b, c_auf_b);
  insert into public.zuweisungen (owner, paket_id, klasse_id, schueler_id) values
    (c_lk_a, c_pak_a1, c_kl_a1, null),      -- Paket A1 an Klasse 7a
    (c_lk_a, c_pak_a2, null, c_sch_a2),     -- Paket A2 nur an Eule-02
    (c_lk_b, c_pak_b, c_kl_b1, null);       -- Paket B an Klasse von Lehrkraft B
  insert into public.kompetenzen (id, owner, code, kerncurriculum, bereich, stufe, kompetenz) values
    (c_kom_a, c_lk_a, 'T-A-1', 'Realschule', 'Rechtschreibung', '6', 'Test A'),
    (c_kom_b, c_lk_b, 'T-B-1', 'Realschule', 'Rechtschreibung', '6', 'Test B');
  insert into public.aufgabe_kompetenzen (aufgabe_id, kompetenz_id) values (c_auf_a, c_kom_a), (c_auf_b, c_kom_b), (c_auf_a2, c_kom_a);
  update public.schueler set kerncurriculum = 'Realschule' where id in (c_sch_a1, c_sch_a2, c_sch_b1);

  -- Rechenbeispiel für Eule-02 (Aufgabe "mittel" = höchstens 85 Punkte):
  -- vor ~20 Tagen 4× nur 20 % richtig (je 17 Punkte), in den letzten Tagen 4× alles richtig (je 85 Punkte).
  -- Erwartet: Stand 61,7 ("o"), Startstand 17 ("--"), Trend +2 Stufen → Kategorie "deutlich".
  insert into public.versuche (client_id, schueler_id, aufgabe_id, paket_id, antworten, ergebnis, anteil_richtig, richtig, bearbeitet_am)
  select gen_random_uuid(), c_sch_a2, c_auf_a2, c_pak_a2, '{}', '{}', w.anteil, w.anteil = 1, now() - w.tage * interval '1 day'
  from (values (0.2, 20), (0.2, 19), (0.2, 18), (0.2, 17), (1.0, 3), (1.0, 2), (1.0, 1), (1.0, 0)) w (anteil, tage);

  -- =================================================================
  -- Teil 1: Nicht angemeldet (so greifen Schüler:innen zu)
  -- =================================================================
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- 1.1 Keine Tabelle ist direkt lesbar
  declare t text;
  begin
    foreach t in array array['klassen','schueler','aufgaben','pakete','paket_aufgaben','zuweisungen','versuche','loesung_angesehen','kompetenzen','aufgabe_kompetenzen'] loop
      begin
        execute format('select count(*) from public.%I', t) into n;
        raise exception 'FEHLGESCHLAGEN: anon kann Tabelle % lesen', t;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end;
  ok := ok || '1.1 anon liest keine Tabelle'::text;

  -- 1.2 Direktes Schreiben in versuche ist verboten
  begin
    insert into public.versuche (client_id, schueler_id, aufgabe_id, antworten, ergebnis, anteil_richtig, richtig)
    values (gen_random_uuid(), c_sch_a1, c_auf_a, '{}', '{}', 1, true);
    raise exception 'FEHLGESCHLAGEN: anon kann versuche schreiben';
  exception when insufficient_privilege then null;
  end;
  ok := ok || '1.2 anon schreibt keine Versuche direkt'::text;

  -- 1.3 Interne Funktionen sind gesperrt
  declare f text;
  begin
    foreach f in array array[
      'select public.pruefe_aufgabe(''lueckentext'', ''{}''::jsonb, ''{}''::jsonb)',
      'select public.nur_loesung(''lueckentext'', ''{}''::jsonb)',
      'select public.schueler_zum_token(''x'')',
      'select public.neuer_token()'
    ] loop
      begin
        execute f;
        raise exception 'FEHLGESCHLAGEN: anon darf ausführen: %', f;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end;
  ok := ok || '1.3 anon darf interne Funktionen nicht aufrufen'::text;

  -- 1.4 Falscher Token wird abgewiesen
  begin
    perform public.schueler_start('gibt-es-nicht-xxxxxxxxxxxxxxx');
    raise exception 'FEHLGESCHLAGEN: falscher Token akzeptiert';
  exception when sqlstate 'P0002' then null;
  end;
  ok := ok || '1.4 falscher Token abgewiesen'::text;

  -- 1.5 Startseite zeigt nur eigene Pakete und KEINE Lösungen
  v := public.schueler_start(c_tok_a1);
  if v ->> 'pseudonym' <> 'Fuchs-01' then raise exception 'FEHLGESCHLAGEN: falsches Pseudonym %', v; end if;
  if jsonb_array_length(v -> 'pakete') <> 1 or v -> 'pakete' -> 0 ->> 'titel' <> 'Paket A1' then
    raise exception 'FEHLGESCHLAGEN: falsche Pakete für A1: %', v -> 'pakete';
  end if;
  if v::text like '%loesungen%' or v::text like '%[dass]%' or v::text like '%"dass"%' then
    raise exception 'FEHLGESCHLAGEN: Lösung in schueler_start sichtbar: %', v;
  end if;
  if v::text like '%Ersatzprobe%' then
    raise exception 'FEHLGESCHLAGEN: Fehler-Rückmeldung vorab sichtbar';
  end if;
  ok := ok || '1.5 Startseite: nur eigene Pakete, keine Lösungen'::text;

  -- 1.6 Einzeln zugewiesenes Paket sieht nur die betroffene Person
  v := public.schueler_start(c_tok_a2);
  if jsonb_array_length(v -> 'pakete') <> 1 or v -> 'pakete' -> 0 ->> 'titel' <> 'Paket A2' then
    raise exception 'FEHLGESCHLAGEN: falsche Pakete für A2: %', v -> 'pakete';
  end if;
  ok := ok || '1.6 Einzelzuweisung korrekt'::text;

  -- 1.7 Fremde Aufgaben können nicht beantwortet werden
  begin
    perform public.antwort_abgeben(c_tok_a1, c_pak_b, c_auf_b, '{"0":"dass"}', gen_random_uuid());
    raise exception 'FEHLGESCHLAGEN: A1 kann Aufgabe von Lehrkraft B beantworten';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.antwort_abgeben(c_tok_a1, c_pak_a2, c_auf_a2, '{"0":"dass"}', gen_random_uuid());
    raise exception 'FEHLGESCHLAGEN: A1 kann nicht zugewiesenes Paket A2 beantworten';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    -- Aufgabe aus fremdem Paket über ein eigenes Paket "einschmuggeln"
    perform public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a2, '{"0":"dass"}', gen_random_uuid());
    raise exception 'FEHLGESCHLAGEN: Aufgabe außerhalb des Pakets beantwortbar';
  exception when sqlstate 'P0002' then null;
  end;
  ok := ok || '1.7 fremde/nicht zugewiesene Aufgaben gesperrt'::text;

  -- 1.8 Prüfen: richtig, falsch, Groß-/Kleinschreibung, Leerzeichen
  v := public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a, '{"0":"das"}', 'aaaaaaaa-0000-4000-8000-00000000f001');
  if (v -> 'ergebnis' ->> 'richtig')::boolean then raise exception 'FEHLGESCHLAGEN: "das" als richtig gewertet'; end if;
  if v ->> 'rueckmeldung' is null then raise exception 'FEHLGESCHLAGEN: keine Rückmeldung bei Fehler'; end if;
  v := public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a, '{"0":"Dass"}', gen_random_uuid());
  if (v -> 'ergebnis' ->> 'richtig')::boolean then raise exception 'FEHLGESCHLAGEN: Großschreibung ignoriert'; end if;
  v := public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a, '{"0":"  dass "}', gen_random_uuid());
  if not (v -> 'ergebnis' ->> 'richtig')::boolean then raise exception 'FEHLGESCHLAGEN: richtige Antwort abgelehnt: %', v; end if;
  if v ->> 'rueckmeldung' is not null then raise exception 'FEHLGESCHLAGEN: Fehler-Rückmeldung trotz richtig'; end if;
  if (v ->> 'versuche')::int <> 3 then raise exception 'FEHLGESCHLAGEN: Versuchszahl %', v ->> 'versuche'; end if;
  ok := ok || '1.8 Prüfung richtig/falsch/Großschreibung/Leerzeichen'::text;

  -- 1.9 Doppelt gesendeter Versuch wird nur einmal gespeichert
  v := public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a, '{"0":"das"}', 'aaaaaaaa-0000-4000-8000-00000000f001');
  if (v ->> 'versuche')::int <> 3 then raise exception 'FEHLGESCHLAGEN: Doppelversand gezählt'; end if;
  ok := ok || '1.9 doppelt gesendete Versuche nur einmal gespeichert'::text;

  -- 1.10 Lösung erst nach 2 Versuchen; danach zählen Versuche nicht für den Lernstand
  begin
    perform public.loesung_anzeigen(c_tok_a2, c_pak_a2, c_auf_a2);
    raise exception 'FEHLGESCHLAGEN: Lösung vor 2 Versuchen';
  exception when sqlstate 'P0001' then null;
  end;
  v := public.loesung_anzeigen(c_tok_a1, c_pak_a1, c_auf_a);
  if v -> 'luecken' -> 0 -> 'loesungen' ->> 0 <> 'dass' then raise exception 'FEHLGESCHLAGEN: Lösung falsch: %', v; end if;
  perform public.antwort_abgeben(c_tok_a1, c_pak_a1, c_auf_a, '{"0":"dass"}', 'aaaaaaaa-0000-4000-8000-00000000f002');
  ok := ok || '1.10 Lösung erst nach 2 Versuchen'::text;

  -- 1.11 Token von A1 gibt keine Lösung von B heraus
  begin
    perform public.loesung_anzeigen(c_tok_a1, c_pak_b, c_auf_b);
    raise exception 'FEHLGESCHLAGEN: fremde Lösung abrufbar';
  exception when sqlstate 'P0002' then null;
  end;
  ok := ok || '1.11 keine fremden Lösungen'::text;

  -- 1.13 Entwicklung für Schüler:innen: Kategorie ja, absolute Werte NIE
  v := public.schueler_entwicklung(c_tok_a2);
  if v -> 'kompetenzen' -> 0 ->> 'kategorie' <> 'deutlich' then
    raise exception 'FEHLGESCHLAGEN: Kategorie % statt deutlich: %', v -> 'kompetenzen' -> 0 ->> 'kategorie', v;
  end if;
  if v::text ~ '"(punkte|stufe|start_|vergleich_|trend_|verlauf|anzahl)' or v::text like '%61.7%' then
    raise exception 'FEHLGESCHLAGEN: absolute Werte in schueler_entwicklung: %', v;
  end if;
  if v ->> 'naechster_schritt' is null then raise exception 'FEHLGESCHLAGEN: kein nächster Schritt: %', v; end if;
  v := public.schueler_entwicklung(c_tok_a1);
  if v -> 'kompetenzen' -> 0 ->> 'kategorie' <> 'erste' then
    raise exception 'FEHLGESCHLAGEN: A1 sollte "erste Ergebnisse" haben: %', v;
  end if;
  ok := ok || '1.13 Schüler-Entwicklung ohne absolute Werte'::text;

  -- 1.14 Lehrkraft-Auswertungen sind für Schüler:innen gesperrt
  declare f text;
  begin
    foreach f in array array[
      format('select * from public.lernstand_klasse(%L)', c_kl_a1),
      format('select * from public.lernstand_schueler(%L)', c_sch_a2),
      format('select public.gewertete_versuche(%L, %L, null::public.einstellungen)', c_sch_a2, c_kom_a)
    ] loop
      begin
        execute f;
        raise exception 'FEHLGESCHLAGEN: anon darf ausführen: %', f;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end;
  ok := ok || '1.14 anon erreicht keine Lernstands-Funktionen'::text;

  reset role;

  -- Kontrolle als Verwalter: Versuch nach Lösungsansicht zählt nicht
  if (select zaehlt_fuer_lernstand from public.versuche where client_id = 'aaaaaaaa-0000-4000-8000-00000000f002') then
    raise exception 'FEHLGESCHLAGEN: Versuch nach Lösungsansicht zählt für Lernstand';
  end if;
  ok := ok || '1.12 Versuch nach Lösungsansicht zählt nicht'::text;

  -- =================================================================
  -- Teil 2: Angemeldet als Lehrkraft A
  -- =================================================================
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', c_lk_a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.klassen;
  if n <> 2 then raise exception 'FEHLGESCHLAGEN: A sieht % Klassen statt 2', n; end if;
  select count(*) into n from public.schueler where id = c_sch_b1;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A sieht Schüler von B'; end if;
  select count(*) into n from public.aufgaben where owner = c_lk_b;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A sieht Aufgaben von B'; end if;
  select count(*) into n from public.versuche;
  if n <> 12 then raise exception 'FEHLGESCHLAGEN: A sieht % Versuche statt 12', n; end if;
  ok := ok || '2.1 Lehrkraft sieht nur eigene Daten'::text;

  update public.aufgaben set titel = 'gehackt' where id = c_auf_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A ändert Aufgabe von B'; end if;
  delete from public.klassen where id = c_kl_b1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A löscht Klasse von B'; end if;
  ok := ok || '2.2 Lehrkraft ändert/löscht nichts Fremdes'::text;

  begin
    insert into public.schueler (klasse_id, pseudonym) values (c_kl_b1, 'Eindringling');
    raise exception 'FEHLGESCHLAGEN: A legt Schüler in Klasse von B an';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.zuweisungen (paket_id, klasse_id) values (c_pak_a1, c_kl_b1);
    raise exception 'FEHLGESCHLAGEN: A weist Paket an Klasse von B zu';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.paket_aufgaben (paket_id, aufgabe_id) values (c_pak_a1, c_auf_b);
    raise exception 'FEHLGESCHLAGEN: A packt Aufgabe von B in eigenes Paket';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.klassen (owner, name) values (c_lk_b, 'untergeschoben');
    raise exception 'FEHLGESCHLAGEN: A legt Klasse im Namen von B an';
  exception when insufficient_privilege then null;
  end;
  ok := ok || '2.3 keine Einträge in fremdem Namen'::text;

  begin
    insert into public.versuche (client_id, schueler_id, aufgabe_id, antworten, ergebnis, anteil_richtig, richtig)
    values (gen_random_uuid(), c_sch_a1, c_auf_a, '{}', '{}', 1, true);
    raise exception 'FEHLGESCHLAGEN: Lehrkraft kann Versuche fälschen';
  exception when insufficient_privilege then null;
  end;
  ok := ok || '2.4 Lehrkraft kann keine Versuche fälschen'::text;

  -- Kompetenzen: nur eigene sichtbar, fremde nicht mit eigenen Aufgaben verknüpfbar, verwendete nicht löschbar
  select count(*) into n from public.kompetenzen where owner = c_lk_b;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A sieht Kompetenzen von B'; end if;
  select count(*) into n from public.aufgabe_kompetenzen;
  if n <> 2 then raise exception 'FEHLGESCHLAGEN: A sieht % Kompetenz-Zuordnungen statt 2', n; end if;
  begin
    insert into public.aufgabe_kompetenzen (aufgabe_id, kompetenz_id) values (c_auf_a2, c_kom_b);
    raise exception 'FEHLGESCHLAGEN: A verknüpft Kompetenz von B';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.kompetenzen where id = c_kom_a;
    raise exception 'FEHLGESCHLAGEN: verwendete Kompetenz gelöscht';
  exception when foreign_key_violation then null;
  end;
  ok := ok || '2.5a Kompetenzen getrennt und geschützt'::text;

  -- Lernstand: Rechenbeispiel stimmt, fremde Klassen/Schüler:innen liefern nichts
  select l.daten into v from public.lernstand_schueler(c_sch_a2) l where l.kompetenz_id = c_kom_a;
  if abs((v ->> 'punkte')::numeric - 61.7) > 0.05 or (v ->> 'stufe')::int <> 2
     or (v ->> 'start_stufe')::int <> 0 or (v ->> 'trend_stufen')::int <> 2 or not (v ->> 'trend_gueltig')::boolean then
    raise exception 'FEHLGESCHLAGEN: Rechenbeispiel: %', v;
  end if;
  select count(*) into n from public.lernstand_klasse(c_kl_a2);
  if n <> 1 then raise exception 'FEHLGESCHLAGEN: Klassen-Lernstand liefert % Zeilen', n; end if;
  select count(*) into n from public.lernstand_klasse(c_kl_b1);
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A sieht Lernstand der Klasse von B'; end if;
  select count(*) into n from public.lernstand_schueler(c_sch_b1);
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A sieht Lernstand von Schüler:in von B'; end if;
  select count(*) into n from public.einstellungen;
  if n <> 1 then raise exception 'FEHLGESCHLAGEN: A sieht % Einstellungen', n; end if;
  ok := ok || '2.5b Lernstand korrekt berechnet und getrennt'::text;

  -- KC wird pro Klasse festgelegt und an alle (auch neue) Schüler:innen weitergegeben
  update public.klassen set kerncurriculum = 'Gymnasium' where id = c_kl_a2;
  if (select kerncurriculum from public.schueler where id = c_sch_a2) is distinct from 'Gymnasium' then
    raise exception 'FEHLGESCHLAGEN: KC der Klasse nicht übernommen';
  end if;
  insert into public.schueler (klasse_id, pseudonym, kerncurriculum) values (c_kl_a2, 'Neu-01', 'Hauptschule');
  if (select kerncurriculum from public.schueler where klasse_id = c_kl_a2 and pseudonym = 'Neu-01') is distinct from 'Gymnasium' then
    raise exception 'FEHLGESCHLAGEN: neue Schülerin übernimmt KC der Klasse nicht';
  end if;
  update public.klassen set kerncurriculum = 'Hauptschule' where id = c_kl_b1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FEHLGESCHLAGEN: A ändert KC in Klasse von B'; end if;
  ok := ok || '2.5c KC pro Klasse'::text;

  -- Eigene Schülerin anlegen: bekommt automatisch einen langen Token
  insert into public.schueler (klasse_id, pseudonym) values (c_kl_a1, 'Igel-09') returning length(token) into n;
  if n < 32 then raise exception 'FEHLGESCHLAGEN: Token zu kurz (%)', n; end if;
  ok := ok || '2.5 neue Links haben 192-Bit-Token'::text;

  -- Vorschau-Prüfung für Lehrkräfte
  v := public.pruefe_aufgabe('lueckentext', c_inhalt, '{"0":"dass"}');
  if not (v ->> 'richtig')::boolean then raise exception 'FEHLGESCHLAGEN: Vorschau-Prüfung'; end if;
  ok := ok || '2.6 Vorschau-Prüfung funktioniert'::text;

  reset role;

  -- Alles rückgängig machen und Ergebnis melden
  raise exception 'ALLE TESTS BESTANDEN (%): %', array_length(ok, 1), array_to_string(ok, ' | ');
end
$test$;
