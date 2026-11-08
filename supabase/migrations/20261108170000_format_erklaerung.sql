-- =====================================================================
-- Erklärseite im Aufgabenpaket (Typ „erklaerung“, ähnlich Lern-App Anton)
-- =====================================================================
-- Inhalt: {"teile":[], "erklaerung":{"text":"…","merke":"…","beispiele":["Ich weiß, [dass] du kommst.", …]}}
--   * keine Lösungen – Schüler:innen bekommen „erklaerung“ vollständig
--   * „Verstanden – weiter“ = Abgabe mit leerer Antwort → richtig (zählt im Paket als erledigt)
--   * zählt NIE für den Lernstand (zaehlt_fuer_lernstand = false)

alter table public.aufgaben drop constraint aufgaben_typ_check;
alter table public.aufgaben add constraint aufgaben_typ_check
  check (typ in ('lueckentext', 'auswahl', 'zuordnen', 'fehler', 'reihenfolge', 'ueberarbeiten', 'erklaerung'));

-- Prüfung: vorhandene Logik für alle Aufgabenformate, Erklärseite ist immer „gelesen“
alter function public.pruefe_aufgabe(text, jsonb, jsonb) rename to pruefe_aufgabe_formate;
-- shortcut: die alte Funktion bleibt unter neuem Namen (nur intern); beim nächsten Umbau der Prüfung zusammenführen
revoke execute on function public.pruefe_aufgabe_formate(text, jsonb, jsonb) from public, anon;
grant execute on function public.pruefe_aufgabe_formate(text, jsonb, jsonb) to authenticated;

create function public.pruefe_aufgabe(p_typ text, p_inhalt jsonb, p_antworten jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ = 'erklaerung' then
    return jsonb_build_object('luecken', '[]'::jsonb, 'anteil', 1, 'richtig', true);
  end if;
  return public.pruefe_aufgabe_formate(p_typ, p_inhalt, p_antworten);
end
$$;
revoke execute on function public.pruefe_aufgabe(text, jsonb, jsonb) from public, anon;
grant execute on function public.pruefe_aufgabe(text, jsonb, jsonb) to authenticated;

-- Auslieferung an Schüler:innen: Erklärseite unverändert (enthält keine Lösungen)
alter function public.inhalt_ohne_loesung(text, jsonb) rename to inhalt_ohne_loesung_formate;
revoke execute on function public.inhalt_ohne_loesung_formate(text, jsonb) from public, anon, authenticated;  -- intern, nur über Schüler-Funktionen

create function public.inhalt_ohne_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ = 'erklaerung' then
    return jsonb_build_object('teile', '[]'::jsonb, 'erklaerung', jsonb_build_object(
      'text', coalesce(p_inhalt -> 'erklaerung' -> 'text', '""'::jsonb),
      'merke', coalesce(p_inhalt -> 'erklaerung' -> 'merke', '""'::jsonb),
      'beispiele', coalesce(p_inhalt -> 'erklaerung' -> 'beispiele', '[]'::jsonb)));
  end if;
  return public.inhalt_ohne_loesung_formate(p_typ, p_inhalt);
end
$$;
revoke execute on function public.inhalt_ohne_loesung(text, jsonb) from public, anon, authenticated;  -- intern, nur über Schüler-Funktionen

alter function public.nur_loesung(text, jsonb) rename to nur_loesung_formate;
revoke execute on function public.nur_loesung_formate(text, jsonb) from public, anon, authenticated;  -- intern, nur über Schüler-Funktionen

create function public.nur_loesung(p_typ text, p_inhalt jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if p_typ = 'erklaerung' then
    return jsonb_build_object('luecken', '[]'::jsonb);
  end if;
  return public.nur_loesung_formate(p_typ, p_inhalt);
end
$$;
revoke execute on function public.nur_loesung(text, jsonb) from public, anon, authenticated;  -- intern, nur über Schüler-Funktionen

-- Antwort abgeben: wie bisher, aber Erklärseiten zählen nie für den Lernstand
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
  end if;

  return jsonb_build_object(
    'ergebnis', v_v.ergebnis,
    'rueckmeldung', case when v_v.richtig then null else v_a.rueckmeldung_fehler end,
    'versuche', (select count(*) from public.versuche v where v.schueler_id = v_s.id and v.aufgabe_id = v_a.id)
  );
end
$$;
