-- Pakete bekommen Tags für Jahrgang (einzelne Jahrgänge 5–10) und Zweig (HS/RS/Gym), mehrere je Paket möglich.
-- Nur für die Lehrkraft (Paketübersicht); die bestehende Regel „Lehrkraft: eigene Pakete“ gilt auch für diese Spalten.
alter table public.pakete
  add column jahrgaenge smallint[] not null default '{}'
    check (jahrgaenge <@ array[5, 6, 7, 8, 9, 10]::smallint[]),
  add column zweige text[] not null default '{}'
    check (zweige <@ array['Hauptschule', 'Realschule', 'Gymnasium']::text[]);
