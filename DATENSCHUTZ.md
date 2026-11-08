# Datenschutz – Übungswiese

Stand: 8. November 2026. Dieses Dokument beschreibt **technische Fakten**: welche Daten die App speichert, wo, wer sie
sieht und wie man sie löscht. Es ist **keine Rechtsberatung** und ersetzt nicht die Prüfung durch die Schulleitung bzw.
die oder den Datenschutzbeauftragten (DSB). Es kann als Grundlage für das Verzeichnis von Verarbeitungstätigkeiten dienen.

Teil A richtet sich an Schulleitung und DSB, Teil B an Schüler:innen und Eltern.

---

## Teil A – für Schulleitung und Datenschutzbeauftragte

### Zweck
Übungsplattform für den Deutschunterricht (Sek I). Die Lehrkraft stellt Aufgaben bereit, Schüler:innen bearbeiten sie
auf dem iPad. Die Lehrkraft sieht die Ergebnisse, um den Unterricht zu planen und Rückmeldung zu geben.
Die App vergibt **keine Noten**.

### Grundsätze
- **Keine Klarnamen:** Schüler:innen erscheinen nur unter einem Pseudonym (z. B. „Fuchs-07“). Die Zuordnung
  Pseudonym → Person hat nur die Lehrkraft (z. B. auf der ausgedruckten Linkliste), sie liegt nicht in der App.
- **Keine Konten für Schüler:innen:** kein Name, keine E-Mail-Adresse, kein Passwort. Zugang über einen persönlichen
  Link mit einer Zufallskennung (192 Bit). Wer den Link hat, kann die Übungen dieser Person bearbeiten – der Link ist
  deshalb wie ein Schlüssel zu behandeln.
- **Keine Tracking-, Analyse- oder Werbedienste**, keine Cookies zu Werbezwecken, keine eingebundenen Schriften oder
  Skripte von fremden Servern (alles wird mit der App selbst ausgeliefert).
- **Datensparsamkeit:** Gespeichert wird nur, was für Übung und Rückmeldung nötig ist (siehe Tabelle).

### Welche Daten gespeichert werden

| Daten | Beispiel | Wo | Wer sieht sie |
|---|---|---|---|
| Lehrkraft-Konto | E-Mail-Adresse, Passwort (nur verschlüsselt als Hash) | Datenbank (Supabase) | nur die Lehrkraft selbst; technisch der Betreiber des Supabase-Projekts |
| Klassen | Name (z. B. „7b“), Kerncurriculum | Datenbank | nur die eigene Lehrkraft |
| Schüler:innen | Pseudonym, Link-Kennung, Klasse, eingestellte Stufe | Datenbank | nur die eigene Lehrkraft; die Person selbst nur ihr eigenes Pseudonym |
| Antworten | eingegebene Antworten, richtig/teilweise, Zeitpunkt, ob die Lösung angesehen wurde | Datenbank | Lehrkraft: alles; Schüler:in: nur eigene Rückmeldungen |
| Abgeleitete Werte | Lernstand je Kompetenz, Sterne-Stufe je Themenbereich, Anzahl Blumen | Datenbank (berechnet) | Lehrkraft: alles; Schüler:in: nur Entwicklung („besser geworden“ usw.), **nie** Punkte, Stufen `--` bis `++` oder Noten |
| Aufgaben, Pakete, Kompetenzen | von der Lehrkraft erstellt | Datenbank | nur die eigene Lehrkraft; Schüler:innen nur zugewiesene Aufgaben **ohne Lösungen** |
| Zwischenspeicher auf dem Gerät | angefangene Antworten, noch nicht gesendete Antworten (offline), Anzahl zuletzt gesehener Blumen | Browser-Speicher (localStorage) des iPads | wer das iPad benutzt |
| Anmeldung der Lehrkraft | Sitzungsschlüssel | Browser-Speicher des Lehrkraft-Geräts | wer das Gerät benutzt |

Die Zugriffsregeln (wer was sieht) sind **in der Datenbank** festgelegt (Row Level Security), nicht nur in der
Oberfläche. Antworten werden auf dem Server geprüft; Lösungen werden nie an die Geräte der Schüler:innen geschickt.
Automatische Tests prüfen diese Regeln nach jeder Änderung.

### Wo die Daten liegen (Dienstleister)
- **Datenbank:** Supabase (Supabase Inc.), Rechenzentrum in **Frankfurt am Main** (AWS-Region `eu-central-1`).
  Supabase führt technische Protokolle (u. a. IP-Adressen von Anfragen) für kurze Zeit.
  *Zu prüfen durch die Schule:* Auftragsverarbeitungsvertrag (DPA) von Supabase, Sitz des Unternehmens in den USA.
- **Auslieferung der App:** GitHub Pages (GitHub Inc., Microsoft). Ausgeliefert werden nur die Programmdateien, **keine
  Schülerdaten**. GitHub erfasst beim Abruf technisch die IP-Adresse. Die Link-Kennung steht hinter dem `#` in der
  Adresse und wird deshalb **nicht** an GitHub gesendet.
  *Zu prüfen durch die Schule:* Datenschutzhinweise von GitHub.
- Der Quellcode ist öffentlich einsehbar. Er enthält **keine** Schülerdaten und keine Passwörter.

### Speicherdauer und Löschen
Es gibt **keine automatische Löschung**. Die Lehrkraft löscht selbst, z. B. zum Schuljahresende:

| Was | Wo in der App | Folge |
|---|---|---|
| Ergebnisse **einer** Schüler:in zurücksetzen | Klasse → Zeile der Person → „Ergebnisse zurücksetzen“ | Antworten, angesehene Lösungen, automatische Stufen und Blumenwiese gelöscht; Pseudonym und Link bleiben |
| Ergebnisse **einer Klasse** zurücksetzen | Klasse → „Ergebnisse der Klasse … zurücksetzen“ | wie oben für alle Schüler:innen der Klasse |
| Schüler:in löschen | Klasse → „Löschen“ | Pseudonym, Link und alle Ergebnisse gelöscht; der Link funktioniert nicht mehr |
| Klasse löschen | Klasse → „Klasse … löschen“ | Klasse, alle Schüler:innen und alle Ergebnisse gelöscht |
| Aufgabe löschen | Aufgabe → „Löschen“ | Aufgabe und alle Antworten zu dieser Aufgabe gelöscht |
| Lehrkraft-Konto löschen | nur im Supabase-Dashboard (Authentication → Users) | löscht automatisch **alle** Daten dieser Lehrkraft |

Gelöschte Daten sind sofort aus der App verschwunden und lassen sich nicht wiederherstellen.
Der Zwischenspeicher auf dem iPad wird gelöscht, indem man in Safari die Website-Daten löscht
(Einstellungen → Safari → Erweitert → Website-Daten).

*Vorschlag:* Klassen am Ende des Schuljahres löschen oder ihre Ergebnisse zurücksetzen; ausgedruckte Linklisten
vernichten, wenn sie nicht mehr gebraucht werden.

### Rechte der Betroffenen
Auskunft und Löschung erfolgen über die Lehrkraft: Sie kann den Lernstand einer Person ansehen und drucken
(„Entwicklung drucken“) sowie Ergebnisse oder die Person löschen (siehe oben).

---

## Teil B – für Schüler:innen und Eltern (einfache Sprache)

**Was speichert die Übungswiese über mich?**
- Deinen **Fantasienamen** (zum Beispiel „Fuchs-07“). Deinen richtigen Namen kennt die App nicht.
- Deine **Antworten** zu den Übungen und wann du sie gemacht hast.
- Ob du dir eine **Lösung** angesehen hast.
- Daraus rechnet die App aus, wie du dich entwickelst und wie viele Blumen auf deiner Wiese wachsen.

**Wer sieht das?**
- **Deine Lehrkraft** sieht deine Antworten und deinen Lernstand. So kann sie dir helfen.
- **Du** siehst deine eigenen Übungen, deine Rückmeldungen und deine Entwicklung. Noten oder Punkte siehst du nicht –
  die gibt es in der App nicht.
- **Andere Schüler:innen** sehen nichts von dir.

**Wo liegen die Daten?**
In einer Datenbank in Frankfurt am Main. Auf deinem iPad merkt sich die App nur angefangene Antworten, damit nichts
verloren geht.

**Was ist mit meinem Link?**
Dein Link ist wie ein Schlüssel. Gib ihn nicht weiter. Wer ihn hat, kann in deinem Namen üben.

**Werden die Daten gelöscht?**
Ja. Deine Lehrkraft kann deine Ergebnisse jederzeit löschen, zum Beispiel am Ende des Schuljahres.
Wenn du das möchtest, sprich deine Lehrkraft an.

**Gibt es Werbung oder Tracking?**
Nein. Die App zeigt keine Werbung und schickt keine Daten an Werbe- oder Analysefirmen.
