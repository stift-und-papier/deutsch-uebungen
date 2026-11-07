// Gemeinsame Datentypen der App (entsprechen den Tabellen in supabase/migrations).

export type Schwierigkeit = 'leicht' | 'mittel' | 'schwer'

export const SCHWIERIGKEITEN: { wert: Schwierigkeit; text: string }[] = [
  { wert: 'leicht', text: 'leicht' },
  { wert: 'mittel', text: 'mittel' },
  { wert: 'schwer', text: 'schwer' },
]

// ---- Aufgabeninhalt: Textstücke, Lücken und Auswahl-Stellen (dürfen gemischt vorkommen) ----

export type AufgabenTyp = 'lueckentext' | 'auswahl' | 'zuordnen' | 'fehler'

export type TextTeil = { t: 'text'; v: string }
export type LueckenTeil = { t: 'luecke'; id: number; loesungen: string[] }
/** Auswahl-Stelle: Möglichkeiten und die Nummern der richtigen (mehrere = Mehrfachauswahl) */
export type AuswahlTeil = { t: 'auswahl'; id: number; optionen: string[]; richtig: number[] }
/** Antippbare Einheit beim Zuordnen (ein Wort oder eine Wortgruppe); kategorie null = gehört zu keiner Kategorie */
export type EinheitTeil = { t: 'einheit'; id: number; v: string; kategorie: string | null }
/** Antippbares Wort beim Fehlerfinden (mit anhängenden Satzzeichen); korrekturen null = fehlerfrei */
export type WortTeil = { t: 'wort'; id: number; v: string; korrekturen: string[] | null }
export type LueckentextTeil = TextTeil | LueckenTeil | AuswahlTeil | EinheitTeil | WortTeil

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
}

/** Was Schüler:innen bekommen: Stellen ohne Lösungen */
export type LueckenTeilOhneLoesung = { t: 'luecke'; id: number }
export type AuswahlTeilOhneLoesung = { t: 'auswahl'; id: number; optionen: string[]; mehrfach: boolean }
export type EinheitOhneLoesung = { t: 'einheit'; id: number; v: string }
export type WortOhneLoesung = { t: 'wort'; id: number; v: string }
export type LueckentextInhaltSchueler = {
  darstellung?: Darstellung
  kategorien?: string[]
  korrigieren?: boolean
  /** Anzahl der Fehler (nur wenn die Lehrkraft sie anzeigen lässt) */
  anzahl_fehler?: number | null
  teile: (TextTeil | LueckenTeilOhneLoesung | AuswahlTeilOhneLoesung | EinheitOhneLoesung | WortOhneLoesung)[]
}

/** Antworten je Stelle: Text bei Lücken, Liste der angetippten Möglichkeiten bei Auswahl, Kategorie beim Zuordnen */
export type Antworten = Record<string, string | number[] | boolean>

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

export type Paket ={ id: string; titel: string; beschreibung: string | null; erstellt_am: string }

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
  luecken: { id: number | null; richtig: boolean }[]
  anteil: number
  richtig: boolean
}

export type SchuelerAufgabe = {
  id: string
  typ: AufgabenTyp
  titel: string
  anweisung: string
  hinweis: string | null
  schwierigkeit: Schwierigkeit
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
