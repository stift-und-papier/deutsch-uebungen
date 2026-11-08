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
  Aufgabeninhalt = Liste `teile` aus `text`, `luecke`, `auswahl`, `einheit`, `wort`, `reihe` und `versionen` (Parser `src/lib/lueckentext.ts`;
  bei `zuordnen` werden alle Wörter zu Einheiten).
  Antworten: Text je Lücke, Liste der gewählten Nummern je Auswahl.
- Ansprache: Lehrkraft-Oberfläche „Sie“, Schüleransicht „du“, einfache Sprache.
- `src/entwicklung/Vorschau.tsx`: nur im Entwicklungsmodus (`npm run dev`, `#/vorschau`, `#/vorschau/klassen`,
  `#/vorschau/aufgabe`) – Lehrkraft-Ansichten mit Beispieldaten ohne Anmeldung prüfen. Nicht im veröffentlichten Paket.

## Design „Übungswiese“
- **Quelle:** Ordner `design/` (nur lokal, nicht im Repo – enthält Schulname und Entwürfe; README, `tokens.json`,
  Baustein-Anleitungen unter `design/components/*/README.md`, PNG-Entwürfe in `design/entwuerfe/`).
- **In der App:** `src/design/` – `tokens.css` (Farben, Abstände, Radien, Schriften als Variablen), `bundle.css`
  (Bausteine `aes-btn`, `aes-card`, `aes-nav`, `aes-gap`, `aes-choice`, `aes-word`, `aes-fb`, `aes-growth`, `aes-level`),
  `fonts/` (Fraunces, Nunito, lokal), `hintergruende/` (SVG). Eingebunden in `src/main.tsx`; App-eigene Regeln in
  `src/index.css` – dort nur Variablen aus `tokens.css`, **keine neuen Farbwerte**.
- **Neue Oberflächen immer zuerst aus den vorhandenen Bausteinen bauen.** Fehlt ein Baustein: der Lehrkraft einen
  vorschlagen und im gleichen Stil (Tokens, Pillen, große Radien) bauen, nichts Eigenes erfinden.
- **Regeln:**
  - Text steht nie direkt auf dem Hintergrundbild, immer auf einer Karte (`aes-card`). Kein Maskottchen, keine Figuren.
  - Buttons sind Pillen; Tippflächen ≥ 48 × 48 px (`--tipp-min`); Fließtext ≥ 17 px; keine Hover-Funktionen.
  - Schüleransicht: Fehler nie rot – „nochmal“ ist Pfirsich (`aes-fb--again`, `aes-gap--again`), richtig ist Grün.
  - Schüler:innen sehen Lernstand **nur** über `aes-growth` (vier Zustände, Entwicklung, nie absolute Stufen).
    `--stufe-*` und `aes-level` (`--` bis `++`) nur in der Lehrkraft-Ansicht, immer mit Symbol im Balken/Feld.
  - Kontrast ≥ 4,5:1 (bei neuen Farbpaaren nachrechnen). Bedeutung nie nur über Farbe (immer Symbol oder Text).
  - Alle Texte Deutsch, einfache Sprache.
- **Aufbau:** Schüler-Übersichten mit Seitenleiste (`SchuelerRahmen`) auf `wiese-tag.svg`; Aufgabenseite ohne Leiste;
  Lehrkraft mit Seitenleiste (`LehrkraftRahmen`), ruhigem Streifen `huegel-abend.svg` oben und einer großen
  `aes-card` pro Seite (`seiten-karte`). Im Hochformat (≤ 900 px) wird die Seitenleiste zur Leiste unten.
- **Bewusste Abweichungen (Lehrkraft-Wunsch):** „deutlich besser“ (`aes-growth--stark`) mit kräftig dunkelgrüner Pille
  und weißer Schrift (Entwicklungsfarbe, nicht `--stufe-plus2`). Auswertungs-Knöpfe grün (`knopf-auswertung`).
  Löschen-Knöpfe in Pflaume statt Rot.
- **Pixel-Icons** (`src/design/icons.css`, SVGs in `src/design/icons/`): nur Schüleransicht (Lehrkraft höchstens sparsam),
  immer `aria-hidden`, Text daneben trägt die Bedeutung, keine Gesichter, nur Größen 32/48/64/96 px.
  **Zuordnungstabelle an einer Stelle: `src/lib/icons.tsx`** (Aufgabenformat → Icon, Kompetenzbereich → Icon,
  Entwicklungszustand → `blume`/`spross`/`giesskanne`/`samen`, Navigation). Neue Formate/Bereiche dort ergänzen.
  Richtig/nochmal bekommt KEIN Pixel-Icon, sondern `aes-fb__icon` (✓ grün, ! Pfirsich).
- **Blumenwiese** (Startseite der Schüler:innen, `src/gemeinsam/Blumenwiese.tsx`, `src/design/wiese.css`, Plätze in
  `src/design/wiese/slots.json`): Blumenzahl rechnet der Server (`schueler_wiese` → nur `{"blumen": n}`) aus der
  **Entwicklung** (je Kompetenz sammeln/dran/gut/stark = 0/1/2/3, einstellbar) + 1 je abgeschlossenem Paket (max. 20),
  höchstens 80. Gespeichert wird der Höchststand `schueler.wiese_blumen` – die Wiese welkt nie. Keine Zahl/kein Bruch
  in der Schüleransicht, Satz unter der Szene, Anzeige nur in ganzzahligen Vielfachen (4× quer, 3× hochkant).
  Füllstände prüfen: `#/vorschau/wiese/<zahl>` (nur `npm run dev`).
- **Schüler-Navigation:** Start (Wiese, `#/s/<token>`), Meine Übungen (`/uebungen`), Mein Lernweg (`/entwicklung`).
- **Offen:** Schullogo fehlt noch – Platz `logo-platz` oben in den Seitenleisten ist reserviert. Navigationspunkt
  „Tipps“ aus dem Entwurf: Inhalt mit der Lehrkraft klären, bis dahin weggelassen (Icon `gluehbirne` dann aus
  `design/assets/Icons/` holen; ungenutzte Icons sind bewusst nicht in der App).

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
2. Lernstand: Kompetenzen importieren, Zuordnung, KC pro Klasse, Lehrkraft- und Schüleransichten ✓
   – Design „Übungswiese“ eingebaut ✓
3. Weitere Aufgabenformate + Schwierigkeitsstufe pro Schüler:in ✓ (Sterne + Automatik; iPad-Test der Stufen steht aus)
4. Politur: Druck/PDF, Offline-Speicher, `DATENSCHUTZ.md`, Löschfunktionen
5. Später: mehrere Lehrkräfte, Aufgaben teilen, PDF/Word-Import

### To-do für weitere Etappen (Wunsch der Lehrkraft, 2026-11-08)
- **Aufgaben erstellen verbessern und übersichtlicher machen** (Editor aufräumen, Formate leichter wählbar).
- **Aufgaben und Aufgabenpakete filtern** ✓ (2026-11-08, Lehrkraft): Titelsuche, Jahrgang **aus den Kompetenzen**
  (KC-Stufe Ende Jg. 6/8/10 → 5/6, 7/8, 9/10; „6-10“ passt überall; „ohne Kompetenz-Zuordnung“), Bereich, einzelne
  Kompetenz. Alle Merkmale müssen bei derselben Kompetenz zutreffen. Logik `src/lib/filter.ts` (getestet),
  Leiste `src/lehrkraft/ListenFilter.tsx`; Pakete erben die Kompetenzen ihrer Aufgaben.
- **Usability-Überarbeitung (Wunsch der Lehrkraft, 2026-11-08):**
  - Lernweg entschlacken (nächster Schritt oben, nach Bereich gruppiert, schlanke Zeilen, Ungeübtes eingeklappt).
  - Editor: „+ Neue Aufgabe“ → Seite mit **anklickbaren Format-Kacheln** (Icon, ein Satz, Mini-Beispiel); Format auch im
    Editor umschaltbar. Editor in Abschnitte Inhalt (Text + Live-Vorschau) / Einordnen (Kompetenz, Schwierigkeit,
    Titel) / Extras (Tipp, Rückmeldung, eingeklappt).
  - Lernweg ✓, Editor (Format-Kacheln, Abschnitte, Live-Vorschau) ✓
  - **Erklärseite im Aufgabenpaket** ✓ (Typ `erklaerung`, `inhalt.erklaerung = {text, merke, beispiele}`,
    Darstellung `ErklaerSeite` in `src/gemeinsam/AufgabeBearbeiten.tsx`, Icon `gluehbirne`): Text + Merkkasten +
    Beispielsätze (`[Wort]` = hervorgehoben), keine Bilder; frei an jeder Stelle im Paket; wiederverwendbar wie Aufgaben;
    „Verstanden – weiter“ = Abgabe `{}` → zählt als erledigt im Paket, **nie für den Lernstand**
    (`antwort_abgeben` setzt `zaehlt_fuer_lernstand = false`), zählt nicht bei „Übungen geschafft“. Keine Schwierigkeit/
    Kompetenzen im Editor. DB: `pruefe_aufgabe`/`inhalt_ohne_loesung`/`nur_loesung` sind dünne Hüllen um die
    `*_formate`-Funktionen (Migration `20261108170000`).

## Lernstand (Etappe 2)
- Kompetenzen pro Lehrkraft (`kompetenzen`, Import aus `docs/kompetenzen.csv` per `node scripts/kompetenzen-sql.ts <uuid>`).
  Kurznamen (`kurzname`) sind Vorschläge von Claude für die Schüleransicht – von der Lehrkraft prüfbar/änderbar.
- Berechnung in SQL (`auswertung`, `stand_bis`, `gewertete_versuche`), Parameter in `einstellungen` (pro Lehrkraft).
- Lehrkraft: `lernstand_klasse`, `lernstand_schueler` (security invoker → RLS greift).
- Schüler:innen: nur `schueler_entwicklung` (security definer) → Kategorien deutlich/besser/dranbleiben/erste,
  Anzahl gelöster Aufgaben, nächster Schritt. **Nie Punkte/Stufen** – Test 1.13 prüft das.

## Entscheidungen (Protokoll)
- 2026-11-08 (didaktisch, Lehrkraft): **Stufen als Sterne + Automatik** (Migration `20261108180000_stufen_automatik.sql`):
  Aufgaben behalten intern `schwierigkeit` leicht/mittel/schwer (= 1/2/3 Sterne, `stufe_nr`/`stufeAus`); angezeigt wird
  überall nur `Sterne` (`src/gemeinsam/Sterne.tsx`, Pixel-Icons `stern`/`stern-leer`, „Stufe n von 3“). Schüler:innen
  bekommen nur `stufe` (Zahl), nie die Wörter. Je Schüler:in: `stufe_manuell` (1–3, gilt für alle Bereiche, Vorrang) oder
  null = automatisch je Themenbereich (`schueler_stufen`, Start 1, nur Aufstieg, nach jeder Abgabe). **Regel nur in
  `stufen_regel()`** (80 %, mind. 5): Anteil der bearbeiteten Aufgaben dieser Stufe und dieses Bereichs, die im ERSTEN
  gewerteten Versuch richtig waren. Bereich einer Aufgabe = `aufgabe_bereich` (Kompetenz im KC der Schüler:in).
  Sichtbar je Paket und Bereich nur die Aufgaben der eigenen Stufe (`sichtbare_aufgaben`; sonst nächst niedrigere, sonst
  niedrigste vorhandene; Erklärseiten immer). Blumenwiese: „Paket abgeschlossen“ zählt nur sichtbare Aufgaben.
  Die Sterne sind die Arbeitsstufe, kein Lernstand – Schüler:innen sehen weiterhin keine `--` bis `++`.
- 2026-11-08 (didaktisch, Lehrkraft): Format **Sätze verbessern** (Typ `ueberarbeiten`, Teil `versionen`, Anzeige
  `src/gemeinsam/VersionenAnzeige.tsx`): je Satz optional `Kontext: …`, dann 2–4 Versionen (eine Zeile je Version,
  bessere mit `*`, genau eine), unter jeder Version `Hinweis: …` (Pflicht). Versionen erscheinen in der geschriebenen
  Reihenfolge. **Hinweise erst nach dem Prüfen**, dann für alle Versionen: `pruefe_aufgabe` liefert sie mit dem
  Ergebnis (`hinweise`), `inhalt_ohne_loesung` schickt nur Kontext und Versionen. Antwort wie Auswahl (`[nr]`).
- 2026-11-08 (didaktisch, Lehrkraft): **Reihenfolge überarbeitet:** Jeder Satz nennt die **Satzart** (aus `.`/`?`/`!`
  = Aussage-/Frage-/Aufforderungssatz, sonst Zeile `Satzart: …`). **Varianten:** Zeile `Varianten: N` fordert N
  verschiedene richtige Sätze aus denselben Bausteinen (jede Variante eigene Reihe; Antwort dann `string[][]`, die DB
  verbraucht je richtige Variante eine Lösung, doppelte zählen nicht). **Keine Hinweise:** Bausteine ohne großen
  Satzanfang und ohne Schlusszeichen (erstes Wort in der Eingabe klein schreiben); beides erscheint erst, wenn der Satz
  richtig liegt (`satzFertig`). Migration `20261108150000_reihenfolge_varianten.sql`.
- 2026-11-08 (didaktisch, Lehrkraft): Format **Reihenfolge** (deckt auch Überarbeitungsformat „Satzbausteine umstellen“
  ab): Schreibweise `Gestern | bin ich | ins Kino | gegangen.` in richtiger Reihenfolge, weitere richtige Reihenfolgen
  in den Zeilen direkt darunter, Leerzeile = neuer Satz (Parser `reihenZuTeilen`). Bausteine bekommen zufällige
  Kennungen `k`; Schüler:innen erhalten sie nach `k` sortiert (= gemischt, nie die Lösung). Antwort = Liste der
  Kennungen. Vergleich ohne Groß-/Kleinschreibung und ohne Satzzeichen am Bausteinende; Rückmeldung je Platz ✓/↻
  (`positionen`), jeder Baustein zählt anteilig. Bedienung (`src/gemeinsam/ReiheAnzeige.tsx`, @dnd-kit): antippen
  legt ans Ende der Reihe bzw. zurück; ziehen in die Reihe, innerhalb verschieben, zurück nach oben.
- 2026-11-08 (didaktisch, Lehrkraft): Format **Fehler finden** (deckt auch Überarbeitungsformat „Fehler markieren und
  korrigieren“ ab): Schreibweise `[weis -> weiß]`, mehrere Verbesserungen mit /; alle Wörter (mit anhängenden
  Satzzeichen) antippbar. Je Aufgabe „nur finden“ oder „finden + eintippen“; „Auswählen“ bewusst weggelassen (würde
  Fehlerstellen verraten). „Finde N Fehler“ standardmäßig an. Nicht gefundene Fehler kommen ohne id zurück
  (`"id": null`) – die Rückmeldung nennt nur die Anzahl.
- 2026-11-08 (didaktisch, Lehrkraft): Format **Zuordnen**: Schreibweise `[Der kleine Hund = Subjekt]` (auch Wortgruppen).
  Bedienung wie Textmarker: erst Kategorie („Stift“) wählen, dann Wörter antippen; Name der Kategorie steht unter dem Wort.
  Alle übrigen Wörter sind ebenfalls antippbar (Ablenker, `kategorie: null`); bewertet werden alle Einheiten mit
  Kategorie und markierte Ablenker. Kategorien = im Text verwendete + selbst eingetragene (`inhalt.kategorien`).
- 2026-11-08: Versionsprüfung (`src/lib/version.ts`): Safari auf dem iPad zeigte nach einer Veröffentlichung noch die
  alte App (GitHub Pages: max-age=600). Die App vergleicht beim Öffnen, alle 5 Minuten und beim Zurückkehren den
  Namen der Programmdatei; beim Öffnen wird einmal automatisch neu geladen, danach nur Hinweis „Neu laden“.
- 2026-11-08 (didaktisch, Lehrkraft): Format **Auswahl**: Schreibweise `[das | *dass]` (| trennt, * = richtig,
  mehrere * = Mehrfachauswahl), Lücken und Auswahl im selben Text mischbar. Standard-Darstellung „Antippen“
  (`aes-choice`), je Aufgabe umstellbar auf Dropdown (nur Einfachauswahl). Mehrfachauswahl zählt nur, wenn genau
  die richtigen gewählt sind. Schüler:innen erfahren nur, OB mehrere richtig sind (`mehrfach`), nicht welche.
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
- 2026-11-07 (Lehrkraft): Keine gemischten Klassen → KC wird **pro Klasse** gewählt (`klassen.kerncurriculum`);
  Trigger übertragen es auf `schueler.kerncurriculum` (darauf basiert die Auswertung). Kompetenz-Kürzel (`code`)
  werden in der Oberfläche nicht mehr angezeigt; Anzeige = Kurzname, darunter klein der KC-Wortlaut.
- 2026-11-07: React statt Svelte – bewährte Drag-&-Drop-Lösung mit Touch-Unterstützung für iPad.
- 2026-11-07: Öffentliches Repo statt privatem (GitHub Pages bei privatem Repo nur mit Bezahlkonto).
  Unbedenklich, weil keine Daten und keine Geheimnisse im Code liegen.
- 2026-11-07: Supabase im kostenlosen Tarif. Erstes Projekt lag versehentlich in London (eu-west-2)
  → neu in Frankfurt angelegt, altes Projekt wird gelöscht. Region immer mit `npx supabase projects list` prüfen.
- 2026-11-07: Supabase CLI in Version 2 (`supabase@2`): Der Browser-Login (`supabase login`) scheitert auf diesem
  Rechner mit „Transport error“ (auch in v3). Anmeldung stattdessen per Zugangsschlüssel (`supabase login --token`).
  Im Terminal-Panel der Lehrkraft scheitern auch andere CLI-Befehle (vermutlich Avast-HTTPS-Prüfung);
  aus Claudes eigener Shell funktionieren sie (`link`, `migration list --linked` ohne DB-Passwort).
