# Deutsch üben

Übungsplattform für Rechtschreibung, Grammatik und Textüberarbeitung (Sek I, Niedersachsen).
Die Lehrkraft erstellt Aufgaben, Schüler:innen bearbeiten sie auf dem iPad über einen persönlichen Link.

- **Adresse der App:** https://stift-und-papier.github.io/deutsch-uebungen/
- **Daten:** Supabase (Region EU/Frankfurt). Im Code liegen keine Schülerdaten.

## Auf dem eigenen Rechner starten

```bash
npm install
npm run dev
```

Danach die angezeigte Adresse (meist http://localhost:5173/deutsch-uebungen/) im Browser öffnen.

## Veröffentlichen

Jede Änderung auf dem Zweig `main` wird automatisch gebaut und auf GitHub Pages veröffentlicht
(siehe `.github/workflows/veroeffentlichen.yml`).

## Weitere Dokumente

- `CLAUDE.md` – Projektregeln, Aufbau und Entscheidungen
- `DATENSCHUTZ.md` – Datenschutz: technische Fakten (für Schulleitung/DSB) und Kurzfassung in einfacher Sprache
- `docs/kompetenzen.csv` – Kompetenzraster nach den Kerncurricula
