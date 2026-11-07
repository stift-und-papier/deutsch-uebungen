-- =====================================================================
-- Etappe 3: Aufgabenformat „Reihenfolge“ (auch Textüberarbeitung: Satzbausteine umstellen)
-- =====================================================================
-- Ein Satz zum Ordnen:
--   {"t":"reihe","id":0,
--    "bausteine":[{"k":"q7f3x2","v":"Gestern"},{"k":"a91kd0","v":"bin ich"}, …],   -- k = zufällige Kennung
--    "loesungen":[["Gestern","bin ich","ins Kino","gegangen."],["Ich bin","gestern", …]]}
--   * Schüler:innen bekommen die Bausteine nach Kennung sortiert (= gemischt) und ohne "loesungen".
--   * Antwort: {"0":["a91kd0","q7f3x2", …]} (Kennungen in der gelegten Reihenfolge)
--   * Verglichen wird Baustein für Baustein mit der am besten passenden Lösung; Groß-/Kleinschreibung und
--     Satzzeichen am Ende eines Bausteins zählen dabei nicht (damit weitere richtige Reihenfolgen möglich sind).
--   * Jeder Baustein zählt für den Lernstand; "positionen" sagt je Platz, ob er stimmt.

alter table public.aufgaben drop constraint aufgaben_typ_check;
alter table public.aufgaben add constraint aufgaben_typ_check
  check (typ in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge'));

-- Baustein für den Vergleich vereinheitlichen
create function public.baustein_norm(p text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(public.normalisiere(p, true), '[.,;:!?]+$', ''))
$$;

-- Vergleicht eine gelegte Reihenfolge (Kennungen) mit allen Lösungen.
-- Ergebnis: {"treffer": n, "anzahl": n, "positionen": [true,false,…]} für die beste Lösung.
create function public.pruefe_reihe(p_teil jsonb, p_antwort jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_texte text[];
  v_anzahl integer := jsonb_array_length(p_teil -> 'bausteine');
  v_loesung jsonb;
  v_pos jsonb;
  v_treffer integer;
  v_best jsonb := null;
  v_best_treffer integer := -1;
  i integer;
begin
  -- gelegte Kennungen in Texte übersetzen (unbekannte Kennungen bleiben leer)
  select coalesce(array_agg((
           select b ->> 'v' from jsonb_array_elements(p_teil -> 'bausteine') b where b ->> 'k' = a.k limit 1
         ) order by a.nr), '{}')
  into v_texte
  from jsonb_array_elements_text(case when jsonb_typeof(p_antwort) = 'array' then p_antwort else '[]'::jsonb end)
       with ordinality a (k, nr);

  for v_loesung in select l from jsonb_array_elements(p_teil -> 'loesungen') l loop
    v_pos := '[]'::jsonb;
    v_treffer := 0;
    for i in 0 .. v_anzahl - 1 loop
      if i < coalesce(array_length(v_texte, 1), 0)
         and public.baustein_norm(v_texte[i + 1]) = public.baustein_norm(v_loesung ->> i) then
        v_treffer := v_treffer + 1;
        v_pos := v_pos || 'true'::jsonb;
      else
        v_pos := v_pos || 'false'::jsonb;
      end if;
    end loop;
    if v_treffer > v_best_treffer then
      v_best_treffer := v_treffer;
      v_best := v_pos;
    end if;
  end loop;

  return jsonb_build_object('treffer', greatest(v_best_treffer, 0), 'anzahl', v_anzahl, 'positionen', coalesce(v_best, '[]'::jsonb),
    'vollstaendig', coalesce(array_length(v_texte, 1), 0) = v_anzahl);
end
$$;

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
begin
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;

  for v_teil in select t from jsonb_array_elements(p_inhalt -> 'teile') t loop
    v_id := v_teil -> 'id';
    if v_teil ->> 't' = 'reihe' then
      -- Reihenfolge: jeder Baustein zählt einzeln
      v_reihe := public.pruefe_reihe(v_teil, p_antworten -> (v_teil ->> 'id'));
      v_anzahl := v_anzahl + (v_reihe ->> 'anzahl')::int;
      v_richtig := v_richtig + (v_reihe ->> 'treffer')::int;
      v_luecken := v_luecken || jsonb_build_object(
        'id', v_id,
        'richtig', (v_reihe ->> 'treffer')::int = (v_reihe ->> 'anzahl')::int and (v_reihe ->> 'vollstaendig')::boolean,
        'positionen', v_reihe -> 'positionen');
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
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge') then
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
          when t ->> 't' = 'reihe' then
            -- Bausteine nach zufälliger Kennung sortiert = gemischt; Lösungen weg
            jsonb_build_object('t', 'reihe', 'id', t -> 'id', 'bausteine', (
              select coalesce(jsonb_agg(jsonb_build_object('k', b -> 'k', 'v', b -> 'v') order by b ->> 'k'), '[]'::jsonb)
              from jsonb_array_elements(t -> 'bausteine') b))
          else t - 'loesungen' - 'richtig' - 'kategorie' - 'korrekturen'
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
  if p_typ not in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge') then
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
          when t ->> 't' = 'reihe' then
            (select coalesce(jsonb_agg((select string_agg(x, ' ' order by n) from jsonb_array_elements_text(l) with ordinality s (x, n))), '[]'::jsonb)
             from jsonb_array_elements(t -> 'loesungen') l)
          else t -> 'loesungen'
        end))
      from jsonb_array_elements(p_inhalt -> 'teile') t
      where t ->> 't' in ('luecke', 'auswahl', 'reihe')
         or (t ->> 't' = 'einheit' and t ->> 'kategorie' is not null)
         or (t ->> 't' = 'wort' and jsonb_typeof(t -> 'korrekturen') = 'array')
    ), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.baustein_norm(text), public.pruefe_reihe(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.baustein_norm(text), public.pruefe_reihe(jsonb, jsonb) to authenticated;
