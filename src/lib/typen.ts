// Gemeinsame Datentypen der App (entsprechen den Tabellen in supabase/migrations).

export type Schwierigkeit = 'leicht' | 'mittel' | 'schwer'

export const SCHWIERIGKEITEN: { wert: Schwierigkeit; text: string }[] = [
  { wert: 'leicht', text: 'leicht' },
  { wert: 'mittel', text: 'mittel' },
  { wert: 'schwer', text: 'schwer' },
]

// ---- Lückentext ----

export type TextTeil = { t: 'text'; v: string }
export type LueckenTeil = { t: 'luecke'; id: number; loesungen: string[] }
export type LueckentextTeil = TextTeil | LueckenTeil

export type LueckentextInhalt = {
  /** Eingabetext der Lehrkraft mit [Lücken] – nur für die Bearbeitung */
  text: string
  gross_klein_beachten: boolean
  teile: LueckentextTeil[]
}

/** Was Schüler:innen bekommen: Lücken ohne Lösungen */
export type LueckenTeilOhneLoesung = { t: 'luecke'; id: number }
export type LueckentextInhaltSchueler = { teile: (TextTeil | LueckenTeilOhneLoesung)[] }

// ---- Tabellen ----

export type Klasse = { id: string; name: string; erstellt_am: string }

export type Schueler = {
  id: string
  klasse_id: string
  pseudonym: string
  token: string
  erstellt_am: string
}

export type Aufgabe = {
  id: string
  typ: 'lueckentext'
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
  luecken: { id: number; richtig: boolean }[]
  anteil: number
  richtig: boolean
}

export type SchuelerAufgabe = {
  id: string
  typ: 'lueckentext'
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
