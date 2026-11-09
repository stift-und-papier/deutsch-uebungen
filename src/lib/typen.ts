// Gemeinsame Datentypen der App (entsprechen den Tabellen in supabase/migrations).

/** Interner Wert der Aufgabenstufe in der Datenbank (bleibt so, damit gespeicherte Daten gültig bleiben).
 *  Angezeigt wird immer als Sterne: leicht = 1, mittel = 2, schwer = 3 (siehe stufeAus). */
export type Schwierigkeit = 'leicht' | 'mittel' | 'schwer'
export type Stufe = 1 | 2 | 3

export const SCHWIERIGKEITEN: { wert: Schwierigkeit; stufe: Stufe }[] = [
  { wert: 'leicht', stufe: 1 },
  { wert: 'mittel', stufe: 2 },
  { wert: 'schwer', stufe: 3 },
]

export const stufeAus = (s: Schwierigkeit): Stufe => (s === 'leicht' ? 1 : s === 'schwer' ? 3 : 2)

/** Sterne als Text – nur wo keine Pixel-Icons möglich sind (z. B. in Auswahllisten) */
export const sternText = (n: Stufe) => '★'.repeat(n) + '☆'.repeat(3 - n)

// ---- Aufgabeninhalt: Textstücke, Lücken und Auswahl-Stellen (dürfen gemischt vorkommen) ----

export type AufgabenTyp = 'lueckentext' | 'auswahl' | 'zuordnen' | 'fehler' | 'reihenfolge' | 'ueberarbeiten' | 'erklaerung'

/** Erklärseite im Paket: Erklärtext (Absätze durch Leerzeile), Merkkasten, Beispielsätze ([Wort] = hervorgehoben) */
export type Erklaerung = { text: string; merke: string; beispiele: string[] }

export type TextTeil = { t: 'text'; v: string }
export type LueckenTeil = { t: 'luecke'; id: number; loesungen: string[] }
/** Auswahl-Stelle: Möglichkeiten und die Nummern der richtigen (mehrere = Mehrfachauswahl) */
export type AuswahlTeil = { t: 'auswahl'; id: number; optionen: string[]; richtig: number[] }
/** Antippbare Einheit beim Zuordnen (ein Wort oder eine Wortgruppe); kategorie null = gehört zu keiner Kategorie */
export type EinheitTeil = { t: 'einheit'; id: number; v: string; kategorie: string | null }
/** Antippbares Wort beim Fehlerfinden (mit anhängenden Satzzeichen); korrekturen null = fehlerfrei */
export type WortTeil = { t: 'wort'; id: number; v: string; korrekturen: string[] | null }
/** Baustein zum Ordnen: k = zufällige Kennung (verrät die Reihenfolge nicht), v = Text */
export type Baustein = { k: string; v: string }
/** Satz zum Ordnen: Bausteine (ohne großen Satzanfang/Schlusszeichen), loesungen = alle richtigen Reihenfolgen,
 *  satzart wird immer angezeigt, zeichen erst bei richtiger Lösung, varianten = so viele verschiedene sind gefordert */
export type ReiheTeil = {
  t: 'reihe'
  id: number
  satzart: string
  zeichen: string
  varianten: number
  bausteine: Baustein[]
  loesungen: string[][]
}
/** Sätze verbessern: Versionen eines Satzes, richtig = Nummer der besseren, hinweise = Begründung je Version
 *  (Hinweise bekommen Schüler:innen erst nach dem Prüfen) */
export type VersionenTeil = { t: 'versionen'; id: number; kontext: string; optionen: string[]; richtig: number[]; hinweise: string[] }
export type LueckentextTeil = TextTeil | LueckenTeil | AuswahlTeil | EinheitTeil | WortTeil | ReiheTeil | VersionenTeil

export type Darstellung = 'antippen' | 'dropdown'

export type LueckentextInhalt = {
  /** Eingabetext der Lehrkraft mit [Lücken] – nur für die Bearbeitung */
  text: string
  gross_klein_beachten: boolean
  /** Wie Auswahl-Stellen bedient werden (Standard: antippen) */
  darstellung?: Darstellung
  /** Kategorien beim Zuordnen (z. B. Nomen, Verb, Adjektiv) */
  kategorien?: string[]
  /** Fehler finden: auch die richtige Form eintippen lassen */
  korrigieren?: boolean
  /** Fehler finden: Anzahl der Fehler anzeigen */
  anzahl_zeigen?: boolean
  teile: LueckentextTeil[]
  /** nur beim Typ „erklaerung“ */
  erklaerung?: Erklaerung
}

/** Was Schüler:innen bekommen: Stellen ohne Lösungen */
export type LueckenTeilOhneLoesung = { t: 'luecke'; id: number }
export type AuswahlTeilOhneLoesung = { t: 'auswahl'; id: number; optionen: string[]; mehrfach: boolean }
export type EinheitOhneLoesung = { t: 'einheit'; id: number; v: string }
export type WortOhneLoesung = { t: 'wort'; id: number; v: string }
/** Bausteine nach Kennung sortiert, also gemischt */
export type ReiheOhneLoesung = {
  t: 'reihe'
  id: number
  satzart?: string
  zeichen?: string
  varianten?: number
  bausteine: Baustein[]
}
export type VersionenOhneLoesung = { t: 'versionen'; id: number; kontext?: string; optionen: string[] }
export type LueckentextInhaltSchueler = {
  darstellung?: Darstellung
  kategorien?: string[]
  korrigieren?: boolean
  /** Anzahl der Fehler (nur wenn die Lehrkraft sie anzeigen lässt) */
  anzahl_fehler?: number | null
  erklaerung?: Erklaerung
  teile: (TextTeil | LueckenTeilOhneLoesung | AuswahlTeilOhneLoesung | EinheitOhneLoesung | WortOhneLoesung | ReiheOhneLoesung | VersionenOhneLoesung)[]
}

/** Antworten je Stelle: Text bei Lücken, Liste der angetippten Möglichkeiten bei Auswahl, Kategorie beim Zuordnen,
 *  Liste der Baustein-Kennungen in gelegter Reihenfolge beim Ordnen */
export type Antwort = string | number[] | boolean | string[] | string[][]
export type Antworten = Record<string, Antwort>

// ---- Tabellen ----

export type Kerncurriculum = 'Gymnasium' | 'Realschule' | 'Hauptschule'

export type Klasse = {
  id: string
  name: string
  jahrgang: number | null
  kerncurriculum: Kerncurriculum | null
  erstellt_am: string
}

export type Schueler = {
  id: string
  klasse_id: string
  pseudonym: string
  token: string
  kerncurriculum: Kerncurriculum | null
  /** von der Lehrkraft gesetzte Stufe; null = automatisch (je Bereich, Tabelle schueler_stufen) */
  stufe_manuell: Stufe | null
  erstellt_am: string
}

export type Aufgabe = {
  id: string
  typ: AufgabenTyp
  titel: string
  anweisung: string
  hinweis: string | null
  rueckmeldung_fehler: string | null
  schwierigkeit: Schwierigkeit
  inhalt: LueckentextInhalt
  erstellt_am: string
  geaendert_am: string
}

export type Kompetenz = {
  id: string
  code: string
  kerncurriculum: 'Gymnasium' | 'Realschule' | 'Hauptschule'
  bereich: string
  stufe: '6' | '8' | '10' | '6-10'
  kompetenz: string
  hinweis: string | null
  kurzname: string | null
  ausgeblendet: boolean
  sortierung: number
}

// Tags eines Pakets (nur Lehrkraft): einzelne Jahrgänge und Schulzweige, je mehrere möglich
export const JAHRGAENGE = [5, 6, 7, 8, 9, 10] as const
export const ZWEIGE = ['Hauptschule', 'Realschule', 'Gymnasium'] as const
export type Zweig = (typeof ZWEIGE)[number]

export type Paket = {
  id: string
  titel: string
  beschreibung: string | null
  jahrgaenge: number[]
  zweige: Zweig[]
  erstellt_am: string
}

export type PaketAufgabe = { paket_id: string; aufgabe_id: string; position: number }

export type Zuweisung = {
  id: string
  paket_id: string
  klasse_id: string | null
  schueler_id: string | null
  erstellt_am: string
}

// ---- Antworten der Schüler-Funktionen ----

export type Pruefergebnis = {
  /** id null = nicht gefundener Fehler (Stelle wird bewusst nicht verraten) */
  luecken: { id: number | null; richtig: boolean; positionen?: boolean[]; variante?: number; hinweise?: string[] }[]
  anteil: number
  richtig: boolean
}

export type SchuelerAufgabe = {
  id: string
  typ: AufgabenTyp
  titel: string
  anweisung: string
  hinweis: string | null
  /** Stufe der Aufgabe als Sternzahl (die Datenbank schickt Schüler:innen nur die Zahl) */
  stufe: Stufe
  inhalt: LueckentextInhaltSchueler
  versuche: number
  geloest: boolean
  loesung_angesehen: boolean
}

export type SchuelerPaket = {
  id: string
  titel: string
  beschreibung: string | null
  aufgaben: SchuelerAufgabe[]
}

export type SchuelerStart = { pseudonym: string; pakete: SchuelerPaket[] }

export type AbgabeAntwort = {
  ergebnis: Pruefergebnis
  rueckmeldung: string | null
  versuche: number
}

export type Loesung = { luecken: { id: number; loesungen: string[] }[] }
