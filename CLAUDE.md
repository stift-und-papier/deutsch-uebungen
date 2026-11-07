# CLAUDE.md – Projektregeln

## Für wen und wie
- Nutzerin/Nutzer ist eine Deutschlehrkraft (KGS Niedersachsen) **ohne Programmiererfahrung**.
  Jeden Schritt kurz in einfachem Deutsch erklären, Fachwörter vermeiden oder erklären.
- Git, Installationen, Konfiguration selbst übernehmen. Was im Browser selbst zu tun ist: Schritt für Schritt anleiten.
- In kleinen, testbaren Etappen arbeiten. **Nach jeder Etappe stoppen** und testen lassen.
- Fachlich-didaktische Entscheidungen **erfragen**, nicht raten.
- Den ursprünglichen Auftrag enthält `claude-code-prompt.md` (nur lokal, nicht im Repo).

## Feste Regeln
- Alle Texte in der Oberfläche auf Deutsch, einfache Sprache (Jahrgang 5–10). Code-Kommentare auf Deutsch.
- **Keine** Tracking-, Analyse- oder Werbedienste, **keine** externen Schriften/CDNs. Nur Systemschriften.
- **Keine Klarnamen** von Schüler:innen, nur Pseudonyme (z. B. „Fuchs-07").
- **Keine Geheimnisse ins Repo** (das Repo ist öffentlich). Der Supabase-`anon`-Schlüssel darf in den Code,
  der `service_role`-Schlüssel und das Datenbank-Passwort **nie**.
- KC-PDFs aus `docs/` nicht ins Repo (Urheberrecht, siehe `.gitignore`).
- Kompetenzen **nicht erfinden** – nur aus `docs/kompetenzen.csv` bzw. durch die Lehrkraft.
- Schüler:innen dürfen **nie** absolute Lernstände sehen (kein `--` bis `++`, keine Prozente, keine Noten) –
  durch Datenbankregeln abgesichert, nicht nur durch die Oberfläche.
- Abweichungen von der Technik vorher mit der Lehrkraft besprechen.

## Technik
- **Frontend:** Vite + React + TypeScript, statisch gebaut, gehostet auf GitHub Pages
  (Repo `stift-und-papier/deutsch-uebungen`, **öffentlich**, kostenloses GitHub-Konto).
  - Pfad-Basis `/deutsch-uebungen/` (siehe `vite.config.ts`). Bau-Ziel Safari 15 (ältere iPads).
  - Veröffentlichung automatisch per GitHub Actions bei Push auf `main`.
- **Backend:** Supabase (kostenloser Tarif, Region EU/Frankfurt), Row Level Security überall an.
  - Projekt-Ref `lmyvdhvuykeiizeeglvc` (Frankfurt, `eu-central-1`), Adresse und publishable Key in `src/lib/supabase.ts`.
  - Datenbankänderungen nur als Migrationen in `supabase/migrations/` (Supabase CLI per `npx supabase`).
  - Kostenloser Tarif pausiert nach ca. 1 Woche ohne Nutzung → im Dashboard mit einem Klick wieder starten.
  - Lehrkraft: Login per E-Mail/Passwort (Supabase Auth).
  - Schüler:innen: kein Konto, sondern zufälliger Link-Token (≥ 128 Bit). Zugriff nur über
    Datenbankfunktionen, die den Token prüfen und nur eigene Aufgaben/Antworten/Entwicklung liefern.
- Datenmodell mit Lehrkraft-Besitz (`owner`-Spalte) von Anfang an, damit später mehrere Lehrkräfte möglich sind.

## Aufbau
- `src/App.tsx`: Hash-Navigation (`src/lib/router.ts`). `#/s/<token>/…` = Schüler:innen, `#/lehrkraft/…` = Lehrkraft.
  Der Token steht hinter `#`, wird also nicht an GitHub Pages gesendet.
- `src/schueler/`: Schüleransicht. Greift **nur** per RPC zu: `schueler_start`, `antwort_abgeben`, `loesung_anzeigen`.
  Entwürfe und Warteschlange (offline) im localStorage (`speicher.ts`).
- `src/lehrkraft/`: Lehrkraft-Oberfläche (Supabase Auth + direkte Tabellenzugriffe, durch RLS geschützt).
- `src/gemeinsam/`: Aufgaben-Komponenten, genutzt von Schüleransicht **und** Vorschau.
- Antworten werden **in der Datenbank** geprüft (`pruefe_aufgabe`, plpgsql). Schüler:innen bekommen Aufgaben ohne
  Lösungen (`inhalt_ohne_loesung` – Achtung: Feld `text` enthält Lösungen und muss immer entfernt werden).
  Jedes neue Aufgabenformat braucht Zweige in `pruefe_aufgabe`, `inhalt_ohne_loesung`, `nur_loesung`.
- Ansprache: Lehrkraft-Oberfläche „Sie“, Schüleransicht „du“, einfache Sprache.

## Tests
- `npm test` – Logik (Lückentext, Pseudonyme) + Zugriff über das Netzwerk ohne Anmeldung (`supabase/tests/netzwerk.test.ts`).
- `npm run test:datenbank` – Zugriffsregeln in der echten DB als anon und als zwei Lehrkräfte; macht alles rückgängig.
  Erfolg = Fehlermeldung „ALLE TESTS BESTANDEN (…)“. **Nach jeder Migration ausführen und erweitern.**
- Datenbankänderungen: neue Datei in `supabase/migrations/`, dann `npm run db:push`.

## Rechner der Lehrkraft (Windows 11)
- Projektordner: `C:\Users\jrkug\Projekte\deutsch-uebungen` (bewusst **nicht** in OneDrive).
- Installiert per winget: Git, Node.js LTS, GitHub CLI (`gh`, angemeldet als `stift-und-papier`).
- Git-Identität: `stift-und-papier` mit GitHub-noreply-Adresse (keine echte E-Mail im öffentlichen Repo).

## Etappen
0. Einrichtung ✓
1. Kern: Login, Klassen/Pseudonyme, Links, Linkliste, Lückentext, Pakete, Bearbeitung, Antworten speichern ✓
2. Lernstand: Kompetenzen importieren, Zuordnung, KC pro Schüler:in, Lehrkraft- und Schüleransichten ← **aktuell**
3. Weitere Aufgabenformate + Schwierigkeitsstufe pro Schüler:in
4. Politur: Druck/PDF, Offline-Speicher, `DATENSCHUTZ.md`, Löschfunktionen
5. Später: mehrere Lehrkräfte, Aufgaben teilen, PDF/Word-Import

## Lernstand (Etappe 2)
- Kompetenzen pro Lehrkraft (`kompetenzen`, Import aus `docs/kompetenzen.csv` per `node scripts/kompetenzen-sql.ts <uuid>`).
  Kurznamen (`kurzname`) sind Vorschläge von Claude für die Schüleransicht – von der Lehrkraft prüfbar/änderbar.
- Berechnung in SQL (`auswertung`, `stand_bis`, `gewertete_versuche`), Parameter in `einstellungen` (pro Lehrkraft).
- Lehrkraft: `lernstand_klasse`, `lernstand_schueler` (security invoker → RLS greift).
- Schüler:innen: nur `schueler_entwicklung` (security definer) → Kategorien deutlich/besser/dranbleiben/erste,
  Anzahl gelöster Aufgaben, nächster Schritt. **Nie Punkte/Stufen** – Test 1.13 prüft das.

## Entscheidungen (Protokoll)
- 2026-11-07 (didaktisch, Lehrkraft): Lernstand-Verfahren wie vorgeschlagen: letzte 10 gewertete Versuche, pro
  Aufgabe/Tag nur der erste, Höchstpunkte leicht/mittel/schwer 70/85/100, Abklingfaktor 0,85, Grenzen 35/55/70/85,
  ab 4 Versuchen; Trend nur bei ≥ 4 neuen Versuchen und ≥ 15 Punkten Veränderung. „Schlechter“ wird Schüler:innen nie
  gezeigt (→ „dranbleiben“). CSV-Auffälligkeiten (HS-Hinweise an RS-Zeilen, das/dass unter Zeichensetzung) bewusst
  unverändert gelassen.
- 2026-11-07 (didaktisch, Lehrkraft): Lücken-Syntax `[Lösung]`, Alternativen mit `/`. Pseudonyme automatisch
  (Tier-Nummer) ODER eigene Liste. Lösung ansehen erst nach 2 Versuchen; danach zählen Versuche nicht für den
  Lernstand (`zaehlt_fuer_lernstand = false`). Rückmeldung pro Lücke (✓ grün / ↻ orange, nie rot).
- 2026-11-07: Prüfung serverseitig (Lösungen bleiben in der DB, Ergebnisse fälschungssicher). Folge: Ohne Internet
  wird die Antwort zwischengespeichert und später geprüft.
- 2026-11-07: Link-Token 192 Bit, im Klartext gespeichert (nur für die eigene Lehrkraft lesbar), damit die Linkliste
  jederzeit neu gedruckt werden kann.
- 2026-11-07 (Lehrkraft): Knopf „Neuer Link“ entfernt (nicht gebraucht). Stattdessen pro Schüler:in
  „Entwicklung drucken“ (`#/lehrkraft/schueler/<id>/drucken`). Lernstand-Knöpfe grün zur Unterscheidung.
- 2026-11-07: React statt Svelte – bewährte Drag-&-Drop-Lösung mit Touch-Unterstützung für iPad.
- 2026-11-07: Öffentliches Repo statt privatem (GitHub Pages bei privatem Repo nur mit Bezahlkonto).
  Unbedenklich, weil keine Daten und keine Geheimnisse im Code liegen.
- 2026-11-07: Supabase im kostenlosen Tarif. Erstes Projekt lag versehentlich in London (eu-west-2)
  → neu in Frankfurt angelegt, altes Projekt wird gelöscht. Region immer mit `npx supabase projects list` prüfen.
- 2026-11-07: Supabase CLI in Version 2 (`supabase@2`): Der Browser-Login (`supabase login`) scheitert auf diesem
  Rechner mit „Transport error“ (auch in v3). Anmeldung stattdessen per Zugangsschlüssel (`supabase login --token`).
  Im Terminal-Panel der Lehrkraft scheitern auch andere CLI-Befehle (vermutlich Avast-HTTPS-Prüfung);
  aus Claudes eigener Shell funktionieren sie (`link`, `migration list --linked` ohne DB-Passwort).
