-- Korrektur: Nicht markierte Wörter galten als „unbekannt“ statt „nicht markiert“ (fehlender Schlüssel = NULL).
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
      v_markiert := coalesce(jsonb_typeof(p_antworten -> (v_teil ->> 'id')) = 'string'
                             or (p_antworten -> (v_teil ->> 'id')) = 'true'::jsonb, false);
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

