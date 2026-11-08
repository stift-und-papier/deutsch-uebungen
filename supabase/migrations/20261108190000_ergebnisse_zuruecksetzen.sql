-- Ergebnisse zurücksetzen (Wunsch der Lehrkraft, 2026-11-08): Pseudonym, Link, Klasse und fest eingestellte Stufe
-- bleiben; alles andere geht auf den Anfang – Antworten, angesehene Lösungen, automatische Stufen (wieder 1 Stern),
-- Blumenwiese (wieder leer). Für eine Klasse oder einzelne Schüler:innen.
-- security definer, weil Stufen und Wiese nur die Datenbank selbst schreibt; geprüft wird der Besitz.
create function public.ergebnisse_zuruecksetzen(p_schueler uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from public.schueler where id = any(p_schueler) and owner = (select auth.uid());
  delete from public.versuche where schueler_id = any(v_ids);
  delete from public.loesung_angesehen where schueler_id = any(v_ids);
  delete from public.schueler_stufen where schueler_id = any(v_ids);
  update public.schueler set wiese_blumen = 0 where id = any(v_ids);
  return cardinality(v_ids);
end
$$;

revoke all on function public.ergebnisse_zuruecksetzen(uuid[]) from public, anon;
grant execute on function public.ergebnisse_zuruecksetzen(uuid[]) to authenticated;
