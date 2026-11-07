-- =====================================================================
-- Etappe 3: Aufgabenformat „Fehler finden“ (auch Textüberarbeitung: Fehler markieren und korrigieren)
-- =====================================================================
-- Jedes Wort (mit anhängenden Satzzeichen) ist antippbar: {"t":"wort","id":4,"v":"weis","korrekturen":["weiß"]}
--   * "korrekturen": null bei fehlerfreien Wörtern (Ablenker)
--   * inhalt.korrigieren: false = nur finden, true = finden und richtige Form eintippen
--   * inhalt.anzahl_zeigen: true = Schüler:innen sehen „Finde 4 Fehler“
--   * Antwort: {"4": true} (nur finden) bzw. {"4": "weiß"} (mit Verbesserung); fehlende Schlüssel = nicht markiert
-- Bewertet werden alle Fehlerwörter und alle fehlerfreien Wörter, die trotzdem markiert wurden.
-- Nicht gefundene Fehler werden OHNE Nummer zurückgemeldet ("id": null), damit die Rückmeldung nicht verrät, wo sie stehen.

alter table public.aufgaben drop constraint aufgaben_typ_check;
alter table public.aufgaben add constraint aufgaben_typ_check check (typ in ('lueckentext', 'auswahl', 'zuordnen', 'fehler'));

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
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;

  for v_teil in select t from jsonb_array_elements(p_inhalt -> 'teile') t loop
    v_id := v_teil -> 'id';
    if v_teil ->> 't' = 'luecke' then
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
      -- markiert = Schlüssel vorhanden mit true oder einem Text
      v_markiert := jsonb_typeof(p_antworten -> (v_teil ->> 'id')) = 'string'
                    or (p_antworten -> (v_teil ->> 'id')) = 'true'::jsonb;
      if jsonb_typeof(v_teil -> 'korrekturen') is distinct from 'array' then
        -- fehlerfreies Wort: zählt nur, wenn es (fälschlich) markiert wurde
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
  );
end
$$;

-- Aufgabeninhalt OHNE Lösungen (für Schüler:innen).
-- Achtung: "text" (Eingabetext der Lehrkraft) enthält die Lösungen und wird bewusst weggelassen.
create or replace function public.inhalt_ohne_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler') then
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
        case when t ->> 't' = 'auswahl'
          then (t - 'richtig' - 'loesungen') || jsonb_build_object('mehrfach', jsonb_array_length(public.indexliste(t -> 'richtig')) > 1)
          else t - 'loesungen' - 'richtig' - 'kategorie' - 'korrekturen'
        end
        order by nr)
      from jsonb_array_elements(p_inhalt -> 'teile') with ordinality e (t, nr)
    ), '[]'::jsonb)
  );
end
$$;

-- Nur die Lösungen (für „Lösung ansehen“).
create or replace function public.nur_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;
  return jsonb_build_object(
    'luecken', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t -> 'id',
        'loesungen', case
          when t ->> 't' = 'auswahl' then
            (select coalesce(jsonb_agg(t -> 'optionen' -> (i::int) order by i::int), '[]'::jsonb)
             from jsonb_array_elements_text(public.indexliste(t -> 'richtig')) i)
          when t ->> 't' = 'einheit' then jsonb_build_array(t -> 'kategorie')
          when t ->> 't' = 'wort' then t -> 'korrekturen'
          else t -> 'loesungen'
        end))
      from jsonb_array_elements(p_inhalt -> 'teile') t
      where t ->> 't' in ('luecke', 'auswahl')
         or (t ->> 't' = 'einheit' and t ->> 'kategorie' is not null)
         or (t ->> 't' = 'wort' and jsonb_typeof(t -> 'korrekturen') = 'array')
    ), '[]'::jsonb)
  );
end
$$;
