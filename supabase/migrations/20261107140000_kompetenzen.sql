-- =====================================================================
-- Etappe 2 (Teil 1): Kompetenzraster, Zuordnung zu Aufgaben, KC pro Schüler:in
-- =====================================================================

-- Kompetenzen gehören einer Lehrkraft (jede kann ihre Liste anpassen).
create table public.kompetenzen (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Kennung aus der CSV, z. B. "GYM-RE-6-03"
  code text not null check (length(btrim(code)) between 1 and 40),
  kerncurriculum text not null check (kerncurriculum in ('Gymnasium', 'Realschule', 'Hauptschule')),
  bereich text not null check (length(btrim(bereich)) between 1 and 80),
  -- Ende Jahrgang 6, 8, 10 oder "6-10" (gilt über alle Stufen). Hauptschule 9/10 steht als "10".
  stufe text not null check (stufe in ('6', '8', '10', '6-10')),
  kompetenz text not null check (length(btrim(kompetenz)) between 1 and 1000),
  hinweis text,
  -- Kurzer, schülerfreundlicher Name für die Schüleransicht, z. B. "s-Laute"
  kurzname text,
  ausgeblendet boolean not null default false,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (owner, code)
);

-- Welche Aufgabe übt welche Kompetenz(en)? Eine Aufgabe kann Kompetenzen aus mehreren KCs haben.
-- Kompetenzen, die verwendet werden, lassen sich nicht löschen (nur ausblenden).
create table public.aufgabe_kompetenzen (
  aufgabe_id uuid not null references public.aufgaben (id) on delete cascade,
  kompetenz_id uuid not null references public.kompetenzen (id) on delete restrict,
  primary key (aufgabe_id, kompetenz_id)
);
create index on public.aufgabe_kompetenzen (kompetenz_id);

-- Nach welchem Kerncurriculum wird die Person bewertet? (KGS: Haupt-, Real-, Gymnasialzweig)
alter table public.schueler
  add column kerncurriculum text check (kerncurriculum in ('Gymnasium', 'Realschule', 'Hauptschule'));

-- Jahrgang der Klasse (für die kumulative Anzeige: Jg. 8 sieht auch Stufe 6)
alter table public.klassen
  add column jahrgang integer check (jahrgang between 5 and 13);

-- ---------- Zugriffsregeln ----------

alter table public.kompetenzen enable row level security;
alter table public.aufgabe_kompetenzen enable row level security;
revoke all on public.kompetenzen, public.aufgabe_kompetenzen from anon;

create policy "Lehrkraft: eigene Kompetenzen" on public.kompetenzen
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "Lehrkraft: Kompetenzen eigener Aufgaben" on public.aufgabe_kompetenzen
  for all to authenticated
  using (exists (select 1 from public.aufgaben a where a.id = aufgabe_id and a.owner = (select auth.uid())))
  with check (
    exists (select 1 from public.aufgaben a where a.id = aufgabe_id and a.owner = (select auth.uid()))
    and exists (select 1 from public.kompetenzen k where k.id = kompetenz_id and k.owner = (select auth.uid()))
  );
