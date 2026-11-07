-- =====================================================================
-- Etappe 3: Aufgabenformat „Auswahl“
-- =====================================================================
-- Eine Auswahl-Stelle im Text: {"t":"auswahl","id":0,"optionen":["das","dass"],"richtig":[1]}
--   * ein Eintrag in "richtig"  = Einfachauswahl, mehrere = Mehrfachauswahl
--   * Antwort der Schüler:innen: {"0":[1]} (Liste der angetippten Möglichkeiten)
--   * Mehrfachauswahl zählt nur als richtig, wenn genau die richtigen gewählt sind (Entscheidung der Lehrkraft)
-- Lücken und Auswahl-Stellen dürfen in einem Text gemischt vorkommen. Darstellung der Auswahl:
--   inhalt.darstellung = 'antippen' (Standard) oder 'dropdown' (nur bei Einfachauswahl).

alter table public.aufgaben drop constraint aufgaben_typ_check;
alter table public.aufgaben add constraint aufgaben_typ_check check (typ in ('lueckentext', 'auswahl'));

-- Gewählte bzw. richtige Möglichkeiten als sortierte Liste ohne Doppelte (Fremdes wird ignoriert).
create function public.indexliste(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
  from (
    select distinct x::int as v
    from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x
    where x ~ '^[0-9]{1,3}$'
  ) s
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
  v_wahl jsonb;
begin
  if p_typ not in ('lueckentext', 'auswahl') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;

  for v_teil in select t from jsonb_array_elements(p_inhalt -> 'teile') t loop
    if v_teil ->> 't' = 'luecke' then
      v_eingabe := public.normalisiere(p_antworten ->> (v_teil ->> 'id'), v_gk);
      select v_eingabe <> '' and exists (
        select 1 from jsonb_array_elements_text(v_teil -> 'loesungen') l
        where public.normalisiere(l, v_gk) = v_eingabe
      ) into v_ok;
    elsif v_teil ->> 't' = 'auswahl' then
      v_wahl := public.indexliste(p_antworten -> (v_teil ->> 'id'));
      v_ok := jsonb_array_length(v_wahl) > 0 and v_wahl = public.indexliste(v_teil -> 'richtig');
    else
      continue;
    end if;
    v_anzahl := v_anzahl + 1;
    if v_ok then
      v_richtig := v_richtig + 1;
    end if;
    v_luecken := v_luecken || jsonb_build_object('id', v_teil -> 'id', 'richtig', v_ok);
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
-- Bei Auswahl-Stellen wird nur verraten, OB mehrere Antworten richtig sind (für die Bedienung), nicht welche.
create or replace function public.inhalt_ohne_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;
  return jsonb_build_object(
    'darstellung', coalesce(p_inhalt ->> 'darstellung', 'antippen'),
    'teile', coalesce((
      select jsonb_agg(
        case when t ->> 't' = 'auswahl'
          then (t - 'richtig' - 'loesungen') || jsonb_build_object('mehrfach', jsonb_array_length(public.indexliste(t -> 'richtig')) > 1)
          else t - 'loesungen' - 'richtig'
        end
        order by nr)
      from jsonb_array_elements(p_inhalt -> 'teile') with ordinality e (t, nr)
    ), '[]'::jsonb)
  );
end
$$;

-- Nur die Lösungen (für „Lösung ansehen“): je Stelle die richtigen Wörter.
create or replace function public.nur_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ not in ('lueckentext', 'auswahl') then
    raise exception 'Unbekannter Aufgabentyp: %', p_typ;
  end if;
  return jsonb_build_object(
    'luecken', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t -> 'id',
        'loesungen', case when t ->> 't' = 'auswahl'
          then (select coalesce(jsonb_agg(t -> 'optionen' -> (i::int) order by i::int), '[]'::jsonb)
                from jsonb_array_elements_text(public.indexliste(t -> 'richtig')) i)
          else t -> 'loesungen'
        end))
      from jsonb_array_elements(p_inhalt -> 'teile') t
      where t ->> 't' in ('luecke', 'auswahl')
    ), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.indexliste(jsonb) from public, anon, authenticated;
grant execute on function public.indexliste(jsonb) to authenticated;
