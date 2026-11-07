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
  - Kostenloser Tarif pausiert nach ca. 1 Woche ohne Nutzung → im Dashboard mit einem Klick wieder starten.
  - Lehrkraft: Login per E-Mail/Passwort (Supabase Auth).
  - Schüler:innen: kein Konto, sondern zufälliger Link-Token (≥ 128 Bit). Zugriff nur über
    Datenbankfunktionen, die den Token prüfen und nur eigene Aufgaben/Antworten/Entwicklung liefern.
- Datenmodell mit Lehrkraft-Besitz (`owner`-Spalte) von Anfang an, damit später mehrere Lehrkräfte möglich sind.

## Rechner der Lehrkraft (Windows 11)
- Projektordner: `C:\Users\jrkug\Projekte\deutsch-uebungen` (bewusst **nicht** in OneDrive).
- Installiert per winget: Git, Node.js LTS, GitHub CLI (`gh`, angemeldet als `stift-und-papier`).
- Git-Identität: `stift-und-papier` mit GitHub-noreply-Adresse (keine echte E-Mail im öffentlichen Repo).

## Etappen
0. Einrichtung ← **aktuell**
1. Kern: Login, Klassen/Pseudonyme, Links, Linkliste, Lückentext, Pakete, Bearbeitung, Antworten speichern
2. Lernstand: Kompetenzen importieren, Zuordnung, KC pro Schüler:in, Lehrkraft- und Schüleransichten
3. Weitere Aufgabenformate + Schwierigkeitsstufe pro Schüler:in
4. Politur: Druck/PDF, Offline-Speicher, `DATENSCHUTZ.md`, Löschfunktionen
5. Später: mehrere Lehrkräfte, Aufgaben teilen, PDF/Word-Import

## Entscheidungen (Protokoll)
- 2026-11-07: React statt Svelte – bewährte Drag-&-Drop-Lösung mit Touch-Unterstützung für iPad.
- 2026-11-07: Öffentliches Repo statt privatem (GitHub Pages bei privatem Repo nur mit Bezahlkonto).
  Unbedenklich, weil keine Daten und keine Geheimnisse im Code liegen.
- 2026-11-07: Supabase im kostenlosen Tarif.
