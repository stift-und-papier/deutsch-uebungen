-- =====================================================================
-- Etappe 3: Aufgabenformat „Sätze verbessern“ (Textüberarbeitung: Welche Version ist besser?)
-- =====================================================================
-- Ein Satz mit Versionen:
--   {"t":"versionen","id":0,"kontext":"Gestern war ich im Zoo.",
--    "optionen":["Dann sah ich … und dann …","Zuerst sah ich …, danach …"],
--    "richtig":[1],
--    "hinweise":["Hier steht zweimal „dann“.","So wiederholt sich kein Wort."]}
--   * Schüler:innen bekommen nur kontext und optionen (ohne "richtig" und ohne "hinweise").
--   * Antwort wie bei Auswahl: {"0":[1]}
--   * Nach dem Prüfen kommen die Begründungshinweise ALLER Versionen mit dem Ergebnis zurück
--     (Wunsch der Lehrkraft: Hinweise erst nach dem Prüfen zeigen).

alter table public.aufgaben drop constraint aufgaben_typ_check;
alter table public.aufgaben add constraint aufgaben_typ_check
  check (typ in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge', 'ueberarbeiten'));

create or replace function public.pruefe_aufgabe(p_typ text, p_inhalt jsonb, p_antworten jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_teil jsonb;
  v_eingabe text;
  v_ok boolean;
  v_luecken jsonb := '[]'::jsonb;
  v_anzahl integer := 0;
  v_richtig integer := 0;
  v_gk boolean := coalesce((p_inhalt ->> 'gross_klein_beachten')::boolean, true);
  v_korrigieren boolean := coalesce((p_inhalt ->> 'korrigieren')::boolean, false);
  v_wahl jsonb;
  v_soll text;
  v_markiert boolean;
  v_id jsonb;
  v_reihe jsonb;
  v_varianten integer;
  v_antwort jsonb;
  v_liste jsonb;
  v_rest jsonb;
  v_reihe_ok boolean;
  j integer;
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge', 'ueberarbeiten') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;

  for v_teil in select t from jsonb_array_elements(p_inhalt -> 'teile') t loop
    v_id := v_teil -> 'id';
    if v_teil ->> 't' = 'reihe' then
      -- Reihenfolge: jede geforderte Variante, jeder Baustein zählt einzeln
      v_varianten := greatest(1, least(10, coalesce((v_teil ->> 'varianten')::int, 1)));
      v_antwort := p_antworten -> (v_teil ->> 'id');
      if jsonb_typeof(v_antwort) = 'array' and jsonb_typeof(v_antwort -> 0) = 'array' then
        v_liste := v_antwort;
      elsif jsonb_typeof(v_antwort) = 'array' then
        v_liste := jsonb_build_array(v_antwort);
      else
        v_liste := '[]'::jsonb;
      end if;
      v_rest := v_teil -> 'loesungen';
      for j in 0 .. v_varianten - 1 loop
        v_reihe := public.pruefe_reihe(jsonb_set(v_teil, '{loesungen}', v_rest), v_liste -> j);
        v_reihe_ok := (v_reihe ->> 'treffer')::int = (v_reihe ->> 'anzahl')::int and (v_reihe ->> 'vollstaendig')::boolean;
        v_anzahl := v_anzahl + (v_reihe ->> 'anzahl')::int;
        v_richtig := v_richtig + (v_reihe ->> 'treffer')::int;
        if v_reihe_ok then
          v_rest := v_rest - (v_reihe ->> 'index')::int;
        end if;
        v_luecken := v_luecken || jsonb_build_object(
          'id', v_id, 'variante', j, 'richtig', v_reihe_ok, 'positionen', v_reihe -> 'positionen');
      end loop;
      continue;
    elsif v_teil ->> 't' = 'versionen' then
      -- Sätze verbessern: wie Auswahl, dazu die Begründungshinweise aller Versionen
      v_wahl := public.indexliste(p_antworten -> (v_teil ->> 'id'));
      v_ok := jsonb_array_length(v_wahl) > 0 and v_wahl = public.indexliste(v_teil -> 'richtig');
      v_anzahl := v_anzahl + 1;
      if v_ok then
        v_richtig := v_richtig + 1;
      end if;
      v_luecken := v_luecken || jsonb_build_object('id', v_id, 'richtig', v_ok,
        'hinweise', coalesce(v_teil -> 'hinweise', '[]'::jsonb));
      continue;
    elsif v_teil ->> 't' = 'luecke' then
      v_eingabe := public.normalisiere(p_antworten ->> (v_teil ->> 'id'), v_gk);
      select v_eingabe <> '' and exists (
        select 1 from jsonb_array_elements_text(v_teil -> 'loesungen') l
        where public.normalisiere(l, v_gk) = v_eingabe
      ) into v_ok;
    elsif v_teil ->> 't' = 'auswahl' then
      v_wahl := public.indexliste(p_antworten -> (v_teil ->> 'id'));
      v_ok := jsonb_array_length(v_wahl) > 0 and v_wahl = public.indexliste(v_teil -> 'richtig');
    elsif v_teil ->> 't' = 'einheit' then
      v_eingabe := nullif(btrim(case when jsonb_typeof(p_antworten -> (v_teil ->> 'id')) = 'string'
                                     then p_antworten ->> (v_teil ->> 'id') end), '');
      v_soll := v_teil ->> 'kategorie';
      continue when v_soll is null and v_eingabe is null;
      v_ok := v_eingabe is not distinct from v_soll;
    elsif v_teil ->> 't' = 'wort' then
      v_markiert := coalesce(jsonb_typeof(p_antworten -> (v_teil ->> 'id')) = 'string'
                             or (p_antworten -> (v_teil ->> 'id')) = 'true'::jsonb, false);
      if jsonb_typeof(v_teil -> 'korrekturen') is distinct from 'array' then
        continue when not v_markiert;
        v_ok := false;
      elsif not v_markiert then
        v_ok := false;
        v_id := 'null'::jsonb; -- nicht gefunden: Stelle nicht verraten
      elsif v_korrigieren then
        v_eingabe := public.normalisiere(case when jsonb_typeof(p_antworten -> (v_teil ->> 'id')) = 'string'
                                              then p_antworten ->> (v_teil ->> 'id') end, v_gk);
        select v_eingabe <> '' and exists (
          select 1 from jsonb_array_elements_text(v_teil -> 'korrekturen') l
          where public.normalisiere(l, v_gk) = v_eingabe
        ) into v_ok;
      else
        v_ok := true;
      end if;
    else
      continue;
    end if;
    v_anzahl := v_anzahl + 1;
    if v_ok then
      v_richtig := v_richtig + 1;
    end if;
    v_luecken := v_luecken || jsonb_build_object('id', v_id, 'richtig', v_ok);
  end loop;

  return jsonb_build_object(
    'luecken', v_luecken,
    'anteil', case when v_anzahl = 0 then 0 else round(v_richtig::numeric / v_anzahl, 3) end,
    'richtig', v_anzahl > 0 and v_richtig = v_anzahl
      and not exists (select 1 from jsonb_array_elements(v_luecken) l where not (l ->> 'richtig')::boolean)
  );
end
$$;

create or replace function public.inhalt_ohne_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge', 'ueberarbeiten') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;
  return jsonb_build_object(
    'darstellung', coalesce(p_inhalt ->> 'darstellung', 'antippen'),
    'kategorien', coalesce(p_inhalt -> 'kategorien', '[]'::jsonb),
    'korrigieren', coalesce((p_inhalt ->> 'korrigieren')::boolean, false),
    'anzahl_fehler', case when coalesce((p_inhalt ->> 'anzahl_zeigen')::boolean, false) then (
      select count(*) from jsonb_array_elements(p_inhalt -> 'teile') t
      where t ->> 't' = 'wort' and jsonb_typeof(t -> 'korrekturen') = 'array'
    ) end,
    'teile', coalesce((
      select jsonb_agg(
        case
          when t ->> 't' = 'auswahl' then
            (t - 'richtig' - 'loesungen') || jsonb_build_object('mehrfach', jsonb_array_length(public.indexliste(t -> 'richtig')) > 1)
          when t ->> 't' = 'versionen' then
            -- nur Kontext und Versionen; welche besser ist und die Hinweise bleiben in der Datenbank
            jsonb_build_object('t', 'versionen', 'id', t -> 'id', 'kontext', coalesce(t -> 'kontext', '""'::jsonb),
              'optionen', t -> 'optionen')
          when t ->> 't' = 'reihe' then
            jsonb_build_object('t', 'reihe', 'id', t -> 'id',
              'satzart', t -> 'satzart', 'zeichen', t -> 'zeichen',
              'varianten', coalesce((t ->> 'varianten')::int, 1),
              'bausteine', (
                select coalesce(jsonb_agg(jsonb_build_object('k', b -> 'k', 'v', b -> 'v') order by b ->> 'k'), '[]'::jsonb)
                from jsonb_array_elements(t -> 'bausteine') b))
          else t - 'loesungen' - 'richtig' - 'kategorie' - 'korrekturen' - 'hinweise'
        end
        order by nr)
      from jsonb_array_elements(p_inhalt -> 'teile') with ordinality e (t, nr)
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.nur_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge', 'ueberarbeiten') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;
  return jsonb_build_object(
    'luecken', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t -> 'id',
        'loesungen', case
          when t ->> 't' in ('auswahl', 'versionen') then
            (select coalesce(jsonb_agg(t -> 'optionen' -> (i::int) order by i::int), '[]'::jsonb)
             from jsonb_array_elements_text(public.indexliste(t -> 'richtig')) i)
          when t ->> 't' = 'einheit' then jsonb_build_array(t -> 'kategorie')
          when t ->> 't' = 'wort' then t -> 'korrekturen'
          when t ->> 't' = 'reihe' then
            (select coalesce(jsonb_agg((select string_agg(x, ' ' order by n) from jsonb_array_elements_text(l) with ordinality s (x, n))), '[]'::jsonb)
             from jsonb_array_elements(t -> 'loesungen') l)
          else t -> 'loesungen'
        end))
      from jsonb_array_elements(p_inhalt -> 'teile') t
      where t ->> 't' in ('luecke', 'auswahl', 'reihe', 'versionen')
         or (t ->> 't' = 'einheit' and t ->> 'kategorie' is not null)
         or (t ->> 't' = 'wort' and jsonb_typeof(t -> 'korrekturen') = 'array')
    ), '[]'::jsonb)
  );
end
$$;
