-- Korrektur: In auswertung() stand noch ein Verweis auf eine umbenannte Variable (v_vgl.punkte).
create or replace function public.auswertung(p_schueler uuid, p_kompetenz uuid, e public.einstellungen) returns jsonb
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
    'trend_punkte', case when v_gueltig then v_jetzt.punkte - v_vgl_punkte end,
    'trend_stufen', case when v_gueltig then v_stufe - v_vgl_stufe end,
    'verlauf', (
      select jsonb_agg(jsonb_build_object('zeit', x.v ->> 'zeit', 'punkte', s.punkte) order by x.n)
      from jsonb_array_elements(v_versuche) with ordinality x (v, n)
      cross join lateral public.stand_bis(v_versuche, (x.v ->> 'zeit')::timestamptz, e) s
      where s.punkte is not null
    )
  );
end
$$;
